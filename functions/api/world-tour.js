// GET /api/world-tour?username=X — World Tour (Use Case 3)
// Rotates through countries the user hasn't visited yet.
// Uses artists.country (seeding country = where artists are popular).

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username');

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    const db = context.env.DB;

    // All distinct seeding countries
    const allCountries = await db
      .prepare('SELECT DISTINCT country FROM artists WHERE country IS NOT NULL ORDER BY country')
      .all();
    const countryList = allCountries.results.map((r) => r.country);

    if (countryList.length === 0) {
      return Response.json({ error: 'No albums in database' }, { status: 404 });
    }

    // Countries the user has already visited
    const visited = await db
      .prepare(
        `SELECT DISTINCT ar.country
         FROM UserAlbum ua
         JOIN albums al ON ua.album_id = al.id
         JOIN artists ar ON al.artist_id = ar.id
         WHERE ua.username = ? AND ar.country IS NOT NULL`
      )
      .bind(username)
      .all();
    const visitedSet = new Set(visited.results.map((r) => r.country));

    let unvisited = countryList.filter((c) => !visitedSet.has(c));
    const passportComplete = unvisited.length === 0;
    if (passportComplete) unvisited = [...countryList];

    // Pick a random unvisited country
    const nextCountry = unvisited[Math.floor(Math.random() * unvisited.length)];

    // Pick a random album from that country, excluding user's history
    let album = await db
      .prepare(
        `SELECT al.id, al.title, al.release_year, al.cover_art_url,
                al.popularity_score, ar.name AS artist_name, ar.country,
                GROUP_CONCAT(DISTINCT g.name) AS genre
         FROM albums al
         JOIN artists ar ON al.artist_id = ar.id
         LEFT JOIN album_genres ag ON al.id = ag.album_id
         LEFT JOIN genres g ON ag.genre_id = g.id
         WHERE ar.country = ?
         AND al.id NOT IN (SELECT album_id FROM UserAlbum WHERE username = ?)
         GROUP BY al.id
         ORDER BY RANDOM() LIMIT 1`
      )
      .bind(nextCountry, username)
      .first();

    // Fallback: try other unvisited countries
    if (!album) {
      for (const fallbackCountry of unvisited) {
        album = await db
          .prepare(
            `SELECT al.id, al.title, al.release_year, al.cover_art_url,
                    al.popularity_score, ar.name AS artist_name, ar.country,
                    GROUP_CONCAT(DISTINCT g.name) AS genre
             FROM albums al
             JOIN artists ar ON al.artist_id = ar.id
             LEFT JOIN album_genres ag ON al.id = ag.album_id
             LEFT JOIN genres g ON ag.genre_id = g.id
             WHERE ar.country = ?
             AND al.id NOT IN (SELECT album_id FROM UserAlbum WHERE username = ?)
             GROUP BY al.id
             ORDER BY RANDOM() LIMIT 1`
          )
          .bind(fallbackCountry, username)
          .first();
        if (album) break;
      }
    }

    if (!album) {
      return Response.json({
        error: "You've explored every album in every country. Incredible.",
        allExplored: true,
        countriesVisited: visitedSet.size,
        totalCountries: countryList.length,
      });
    }

    return Response.json({
      album,
      passportComplete,
      countriesVisited: visitedSet.size,
      totalCountries: countryList.length,
    });
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
