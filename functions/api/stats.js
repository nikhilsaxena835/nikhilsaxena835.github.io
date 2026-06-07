// GET /api/stats?username=X — Cultural Passport statistics

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username');

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    const db = context.env.DB;

    // Countries visited (via artist's seeding country)
    const countries = await db
      .prepare(
        `SELECT DISTINCT ar.country
         FROM UserAlbum ua
         JOIN albums al ON ua.album_id = al.id
         JOIN artists ar ON al.artist_id = ar.id
         WHERE ua.username = ? AND ar.country IS NOT NULL`
      )
      .bind(username)
      .all();

    const totalCountries = await db
      .prepare('SELECT COUNT(DISTINCT country) as count FROM artists WHERE country IS NOT NULL')
      .first();

    // Interaction counts
    const counts = await db
      .prepare(
        'SELECT status, COUNT(*) as count FROM UserAlbum WHERE username = ? GROUP BY status'
      )
      .bind(username)
      .all();

    // Genres explored (via junction table)
    const genresExplored = await db
      .prepare(
        `SELECT COUNT(DISTINCT g.name) as count
         FROM UserAlbum ua
         JOIN albums al ON ua.album_id = al.id
         JOIN album_genres ag ON al.id = ag.album_id
         JOIN genres g ON ag.genre_id = g.id
         WHERE ua.username = ?`
      )
      .bind(username)
      .first();

    const interactions = {};
    for (const row of counts.results) {
      interactions[row.status.toLowerCase()] = row.count;
    }

    return Response.json({
      countriesVisited: countries.results.length,
      totalCountries: totalCountries?.count || 0,
      countriesList: countries.results.map((r) => r.country),
      genresExplored: genresExplored?.count || 0,
      interactions,
    });
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
