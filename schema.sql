-- World Album Discovery — D1 (SQLite) Schema
-- Adapted from the Last.fm + MusicBrainz pipeline spec.

-- Countries lookup
CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,          -- Last.fm country name, e.g. "Japan"
    iso_code TEXT NOT NULL UNIQUE       -- ISO 3166-1 alpha-2, e.g. "JP"
);

-- Artists (seeded from Last.fm geo.getTopArtists)
CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    musicbrainz_artist_id TEXT,
    name TEXT NOT NULL,
    country TEXT,                       -- iso_code of the seeding country (where they're popular)
    listeners INTEGER DEFAULT 0,
    playcount INTEGER DEFAULT 0,
    UNIQUE (name, country)
);

-- Albums (enriched via MusicBrainz, studio albums only)
CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist_id INTEGER NOT NULL,
    musicbrainz_release_group_id TEXT UNIQUE,
    release_year INTEGER,
    release_country TEXT,               -- from MusicBrainz release metadata
    cover_art_url TEXT,
    lastfm_playcount INTEGER DEFAULT 0,
    lastfm_rank INTEGER,
    popularity_score REAL DEFAULT 0,    -- 0-100, log-scaled after ingestion
    UNIQUE (title, artist_id)
);

-- Normalized genres
CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Album ↔ Genre junction
CREATE TABLE IF NOT EXISTS album_genres (
    album_id INTEGER,
    genre_id INTEGER,
    PRIMARY KEY (album_id, genre_id)
);

-- Users
CREATE TABLE IF NOT EXISTS User (
    username TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now'))
);

-- User-Album interaction history
CREATE TABLE IF NOT EXISTS UserAlbum (
    username TEXT NOT NULL,
    album_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('LIKED','DISLIKED','SKIPPED')),
    timestamp TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (username, album_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_country ON albums(release_country);
CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(release_year);
CREATE INDEX IF NOT EXISTS idx_albums_popularity ON albums(popularity_score);
CREATE INDEX IF NOT EXISTS idx_artists_country ON artists(country);
CREATE INDEX IF NOT EXISTS idx_albumgenres_album ON album_genres(album_id);
CREATE INDEX IF NOT EXISTS idx_albumgenres_genre ON album_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_useralb_user ON UserAlbum(username);
CREATE INDEX IF NOT EXISTS idx_useralb_album ON UserAlbum(album_id);
