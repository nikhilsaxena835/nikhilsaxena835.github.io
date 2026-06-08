// seed.js
import { writeFileSync, readFileSync } from 'node:fs';

const LASTFM_API_KEY = '515928d01d6caeca27fd2d2691f2bec0';
const MB_BASE = 'https://musicbrainz.org/ws/2';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const CAA_BASE = 'https://coverartarchive.org/release-group';
const USER_AGENT = 'WorldAlbumDiscovery/1.0 ( https://github.com/nikhilsaxena835 )';

const COUNTRIES = [
  ['JP', 'Japan'], ['IN', 'India'], ['PK', 'Pakistan'], ['BD', 'Bangladesh'],
  ['KR', 'South Korea'], ['CN', 'China'], ['TW', 'Taiwan'], ['TH', 'Thailand'],
  ['ID', 'Indonesia'], ['PH', 'Philippines'], ['BR', 'Brazil'], ['AR', 'Argentina'],
  ['MX', 'Mexico'], ['FR', 'France'], ['DE', 'Germany'], ['TR', 'Turkey'],
  ['NG', 'Nigeria'], ['ZA', 'South Africa'], ['EG', 'Egypt'],
  ['GB', 'United Kingdom'], ['US', 'United States'],
];

const ARTISTS_PER_COUNTRY = Number(process.env.ARTISTS_PER_COUNTRY || 10);
const ALBUMS_PER_ARTIST = Number(process.env.ALBUMS_PER_ARTIST || 5);
const MIN_LISTENERS = Number(process.env.MIN_LISTENERS || 30000);
const MIN_ALBUM_PLAYCOUNT = Number(process.env.MIN_ALBUM_PLAYCOUNT || 2000);
const MIN_LFM_PLAYCOUNT_NO_MB = Number(process.env.MIN_LFM_PLAYCOUNT_NO_MB || 50000);
const TOP_TAGS = Number(process.env.TOP_TAGS || 5);

const REJECT_SECONDARY = new Set([
  'Live', 'Compilation', 'Soundtrack', 'Remix', 'DJ-mix', 'Mixtape/Street',
  'Demo', 'Interview', 'Audiobook', 'Spokenword',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const sqlEsc = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const luceneEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function toInt(v, fallback = 0) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchJsonWithRetry(url, options = {}, {
  retries = 4,
  baseDelayMs = 700,
  label = 'request',
  retryOnStatuses = new Set([429, 500, 502, 503, 504]),
} = {}) {
  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);

      if (retryOnStatuses.has(res.status)) {
        lastErr = new Error(`${label} failed with HTTP ${res.status}`);
        const retryAfter = res.headers.get('retry-after');
        const delay = retryAfter ? Number(retryAfter) * 1000 : baseDelayMs * (attempt + 1);
        if (attempt < retries) {
          await sleep(delay);
          continue;
        }
      }

      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  throw lastErr || new Error(`${label} failed`);
}

async function lastfm(method, params = {}) {
  const qs = new URLSearchParams({
    method,
    api_key: LASTFM_API_KEY,
    format: 'json',
    autocorrect: '1',
    ...params,
  });

  const url = `${LASTFM_BASE}?${qs.toString()}`;

  try {
    const res = await fetchJsonWithRetry(
      url,
      { headers: { 'User-Agent': USER_AGENT } },
      { label: `Last.fm ${method}` }
    );

    await sleep(340);

    if (!res.ok) {
      console.warn(`Last.fm ${res.status}: ${method}`);
      return null;
    }

    const data = await res.json();
    if (data?.error) {
      console.warn(`Last.fm err ${data.error}: ${data.message}`);
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`Last.fm fetch failed: ${err.message}`);
    return null;
  }
}

let mbLastCall = 0;

async function mbRequest(path) {
  const wait = 1100 - (Date.now() - mbLastCall);
  if (wait > 0) await sleep(wait);
  mbLastCall = Date.now();

  const url = `${MB_BASE}${path}${path.includes('?') ? '&' : '?'}fmt=json`;
  try {
    const res = await fetchJsonWithRetry(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      },
      { label: `MusicBrainz ${path}` }
    );

    if (!res.ok) {
      console.warn(`MB ${res.status}: ${path}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.warn(`MB fetch failed: ${err.message}`);
    return null;
  }
}


async function mbSearch(entity, query, limit = 100, offset = 0) {
  const qs = new URLSearchParams({
    query,
    limit: String(limit),
    offset: String(offset),
    // NOTE: do NOT set dismax=true here.
    // dismax is the simple-text parser and rejects fielded Lucene
    // queries (artist:"..." AND releasegroup:"...") with HTTP 406.
  });

  return mbRequest(`/${entity}?${qs.toString()}`);
}


async function resolveReleaseGroup(artistName, albumTitle) {
  const q = `artist:"${luceneEsc(artistName)}" AND releasegroup:"${luceneEsc(albumTitle)}" AND primarytype:album`;
  const search = await mbSearch('release-group', q, 10, 0);
  const candidates = search?.['release-groups'] || [];

  const ranked = candidates
    .filter((rg) => norm(rg['primary-type']) === 'album')
    .sort((a, b) => {
      const aExact = norm(a.title) === norm(albumTitle) ? 1 : 0;
      const bExact = norm(b.title) === norm(albumTitle) ? 1 : 0;
      return (bExact - aExact) || (toInt(b.score, 0) - toInt(a.score, 0));
    });

  const rg = ranked[0] || null;
  if (!rg) return null;

  const secondary = rg['secondary-types'] || [];
  if (secondary.some((t) => REJECT_SECONDARY.has(t))) {
    return { rejected: true };
  }

  const year = rg['first-release-date']
    ? (toInt(String(rg['first-release-date']).slice(0, 4), null))
    : null;

  return {
    rejected: false,
    rgId: rg.id,
    year,
  };
}

async function artistInfo(artistName, mbid) {
  const params = mbid ? { mbid } : { artist: artistName };
  let data = await lastfm('artist.getInfo', params);

  if ((!data || data.error) && mbid) {
    data = await lastfm('artist.getInfo', { artist: artistName });
  }

  return data?.artist?.stats || null;
}

async function topAlbumsForArtist(artistName, mbid, limit) {
  const params = { limit: String(limit) };
  if (mbid) params.mbid = mbid;
  else params.artist = artistName;

  let data = await lastfm('artist.getTopAlbums', params);

  if ((!data || data.error) && mbid) {
    data = await lastfm('artist.getTopAlbums', { artist: artistName, limit: String(limit) });
  }

  return data?.topalbums?.album || [];
}

async function albumTags(artistName, albumTitle) {
  const data = await lastfm('album.getTopTags', {
    artist: artistName,
    album: albumTitle,
  });
  const tags = data?.toptags?.tag || [];
  return tags
    .slice(0, TOP_TAGS)
    .map((t) => String(t.name || '').toLowerCase().trim())
    .filter(Boolean);
}

async function artistTags(artistName, mbid) {
  const params = mbid ? { mbid } : { artist: artistName };
  let data = await lastfm('artist.getTopTags', params);

  if ((!data || data.error) && mbid) {
    data = await lastfm('artist.getTopTags', { artist: artistName });
  }

  const tags = data?.toptags?.tag || [];
  return tags
    .slice(0, TOP_TAGS)
    .map((t) => String(t.name || '').toLowerCase().trim())
    .filter(Boolean);
}

const artists = [];
const albums = [];
const genres = new Map();
const albumGenres = [];
const artistKey = new Map();
const albumKey = new Set();
let nextArtistId = 1;
let nextAlbumId = 1;
let nextGenreId = 1;

function addArtist(a, iso) {
  const key = a.mbid || `${a.name}|${iso}`;
  if (artistKey.has(key)) return artistKey.get(key);

  const id = nextArtistId++;
  artistKey.set(key, id);

  artists.push({
    id,
    mbid: a.mbid || null,
    name: a.name,
    country: iso,
    listeners: toInt(a.listeners, 0),
    playcount: toInt(a.playcount, 0),
  });

  return id;
}

function addAlbum(row) {
  const key = row.rgId ? `rg:${row.rgId}` : `${row.title}|${row.artistId}`;
  if (albumKey.has(key)) return null;

  albumKey.add(key);
  const id = nextAlbumId++;
  albums.push({ id, ...row });
  return id;
}

function genreId(name) {
  if (genres.has(name)) return genres.get(name);
  const id = nextGenreId++;
  genres.set(name, id);
  return id;
}

function linkGenres(albumId, tags) {
  for (const tag of new Set(tags)) {
    const gid = genreId(tag);
    albumGenres.push({ albumId, genreId: gid });
  }
}

async function seedCountry(iso, name) {
  console.log(`\n[${iso}] ${name}`);

  const filename = name.toLowerCase().replace(/ /g, '_') + '.txt';
  const filepath = `country_artist_data/${filename}`;

  let fileContent;
  try {
    fileContent = readFileSync(filepath, 'utf-8');
  } catch (err) {
    console.warn(`  Warning: Could not read ${filepath}`);
    return;
  }

  const allCountryArtists = [];
  for (const line of fileContent.split('\n')) {
    if (line.trim() === '' || line.startsWith('---')) continue;
    const parts = line.split('|').map(p => p.trim());
    if (parts.length === 3) {
      const artistName = parts[0];
      const mbid = parts[1].replace('MBID:', '').trim();
      const score = parseInt(parts[2].replace('Score:', '').trim(), 10) || 0;

      allCountryArtists.push({
        name: artistName,
        mbid: mbid === 'None' || mbid === '' ? null : mbid,
        listeners: score, // using Wikidata sitelinks score
        playcount: 0
      });
    }
  }

  console.log(`  ${allCountryArtists.length} artists returned from local file`);

  let kept = 0;
  let artistCount = 0;
  let successfulArtists = 0;

  for (const ar of allCountryArtists) {
    if (successfulArtists >= ARTISTS_PER_COUNTRY) break;
    artistCount++;
    process.stdout.write(`\r  Processing artists: ${successfulArtists}/${ARTISTS_PER_COUNTRY} (checked ${artistCount})...`);

    const stats = await artistInfo(ar.name, ar.mbid).catch(() => null);
    const lfListeners = toInt(stats?.listeners, 0);
    const lfPlaycount = toInt(stats?.playcount, 0);

    if (lfListeners < MIN_LISTENERS) {
      continue;
    }

    ar.listeners = lfListeners;
    ar.playcount = lfPlaycount;

    const aTags = await artistTags(ar.name, ar.mbid).catch(() => []);
    const topAlbums = await topAlbumsForArtist(ar.name, ar.mbid, ALBUMS_PER_ARTIST);

    let albumsKeptForThisArtist = 0;
    const albumIdsToLink = [];

    for (let rank = 0; rank < topAlbums.length; rank++) {
      process.stdout.write(`\r  Processing artists: ${successfulArtists}/${ARTISTS_PER_COUNTRY} (checked ${artistCount}) [fetching album ${rank + 1}]...`);
      const al = topAlbums[rank];
      const title = String(al?.name || '').trim();
      if (!title || title.toLowerCase() === '(null)') continue;

      const playcount = toInt(al.playcount, 0);
      if (playcount < MIN_ALBUM_PLAYCOUNT) continue;

      const meta = await resolveReleaseGroup(ar.name, title);

      if (!meta || meta.rejected) {
        continue;
      }

      albumIdsToLink.push({
        title,
        rgId: meta?.rgId || null,
        year: meta?.year || null,
        coverArtUrl: meta?.rgId ? `${CAA_BASE}/${meta.rgId}/front-500` : null,
        playcount,
        rank: rank + 1,
      });
    }

    if (albumIdsToLink.length > 0) {
      const artistId = addArtist(ar, iso);
      for (const alData of albumIdsToLink) {
        const albumId = addAlbum({
          artistId,
          ...alData
        });
        if (!albumId) continue;

        let tags = await albumTags(ar.name, alData.title).catch(() => []);
        if (!tags.length) tags = aTags;
        if (tags.length) linkGenres(albumId, tags);
        kept++;
        albumsKeptForThisArtist++;
      }
      if (albumsKeptForThisArtist > 0) {
        successfulArtists++;
      }
    }
  }

  process.stdout.write('\n');
  console.log(`  kept ${kept} albums across ${successfulArtists} artists`);
}

function computePopularity() {
  if (!albums.length) return;

  const artistMap = new Map(artists.map((a) => [a.id, a]));
  const raw = albums.map((al) => {
    const ar = artistMap.get(al.artistId);
    return Math.log1p((ar?.listeners || 0) + (al.playcount || 0));
  });

  const lo = Math.min(...raw);
  const hi = Math.max(...raw);

  albums.forEach((al, i) => {
    al.popularityScore = hi === lo ? 50 : Math.round(((raw[i] - lo) / (hi - lo)) * 10000) / 100;
  });
}

function generateSQL() {
  const out = [];
  out.push('-- Auto-generated seed data for World Album Discovery');
  out.push('-- Country buckets come from Last.fm geo.getTopArtists.');
  out.push('');

  for (const [iso, name] of COUNTRIES) {
    out.push(
      `INSERT OR IGNORE INTO countries (name, iso_code) VALUES (${sqlEsc(name)}, ${sqlEsc(iso)});`
    );
  }
  out.push('');

  for (const a of artists) {
    out.push(
      `INSERT OR IGNORE INTO artists (id, musicbrainz_artist_id, name, country, listeners, playcount) VALUES (${a.id}, ${sqlEsc(a.mbid)}, ${sqlEsc(a.name)}, ${sqlEsc(a.country)}, ${a.listeners}, ${a.playcount});`
    );
  }
  out.push('');

  for (const [name, id] of genres) {
    out.push(`INSERT OR IGNORE INTO genres (id, name) VALUES (${id}, ${sqlEsc(name)});`);
  }
  out.push('');

  for (const al of albums) {
    out.push(
      `INSERT OR IGNORE INTO albums (id, title, artist_id, musicbrainz_release_group_id, release_year, cover_art_url, lastfm_playcount, lastfm_rank, popularity_score) VALUES (${al.id}, ${sqlEsc(al.title)}, ${al.artistId}, ${sqlEsc(al.rgId)}, ${al.year ?? 'NULL'}, ${sqlEsc(al.coverArtUrl)}, ${al.playcount}, ${al.rank}, ${al.popularityScore ?? 0});`
    );
  }
  out.push('');

  for (const ag of albumGenres) {
    out.push(
      `INSERT OR IGNORE INTO album_genres (album_id, genre_id) VALUES (${ag.albumId}, ${ag.genreId});`
    );
  }

  return out.join('\n') + '\n';
}

async function main() {
  console.log('World Album Discovery — seed pipeline');
  console.log('Wikidata pre-fetched artists → Last.fm top albums → MusicBrainz release-group matching');
  console.log(`${COUNTRIES.length} countries, up to ${ARTISTS_PER_COUNTRY} artists/country, ${ALBUMS_PER_ARTIST} albums/artist\n`);

  for (const [iso, name] of COUNTRIES) {
    await seedCountry(iso, name);
  }

  console.log('\nComputing popularity scores...');
  computePopularity();

  const sql = generateSQL();
  writeFileSync('seed.sql', sql, 'utf-8');

  console.log(`\nDone. ${artists.length} artists, ${albums.length} albums, ${genres.size} genres.`);
  console.log('Wrote seed.sql');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});