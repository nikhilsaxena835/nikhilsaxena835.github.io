// GET /api/discover?username=X&country=JP&genre=jazz&decade=1980 — Filtered Discovery (Use Case 2)

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username');
    const country = url.searchParams.get('country');
    const genre = url.searchParams.get('genre');
    const decade = url.searchParams.get('decade');

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    const db = context.env.DB;

    // Build dynamic query
    let conditions = ['al.id NOT IN (SELECT album_id FROM UserAlbum WHERE username = ?1)'];
    const bindings = { 1: username };
    let idx = 2;

    if (country) {
      // Filter by artist's seeding country (where they're popular)
      conditions.push(`ar.country = ?${idx}`);
      bindings[idx] = country;
      idx++;
    }

    if (genre) {
      // Filter via genre junction table
      conditions.push(`al.id IN (SELECT ag2.album_id FROM album_genres ag2 JOIN genres g2 ON ag2.genre_id = g2.id WHERE g2.name = ?${idx})`);
      bindings[idx] = genre;
      idx++;
    }

    if (decade) {
      const decadeStart = parseInt(decade, 10);
      if (!isNaN(decadeStart)) {
        conditions.push(`al.release_year >= ?${idx} AND al.release_year < ?${idx + 1}`);
        bindings[idx] = decadeStart;
        bindings[idx + 1] = decadeStart + 10;
        idx += 2;
      }
    }

    const query = `
      SELECT al.id, al.title, al.release_year, al.cover_art_url,
             al.popularity_score, al.musicbrainz_release_group_id,
             ar.name AS artist_name, ar.country,
             GROUP_CONCAT(DISTINCT g.name) AS genre
      FROM albums al
      JOIN artists ar ON al.artist_id = ar.id
      LEFT JOIN album_genres ag ON al.id = ag.album_id
      LEFT JOIN genres g ON ag.genre_id = g.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY al.id
      ORDER BY RANDOM() LIMIT 1`;

    const album = await db.prepare(query).bind(...Object.values(bindings)).first();

    if (!album) {
      return Response.json(
        { error: 'No albums match your filters. Try broadening your search.', noResults: true },
        { status: 404 }
      );
    }

    return Response.json({ album });
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
