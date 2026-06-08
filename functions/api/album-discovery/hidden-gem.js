// GET /api/hidden-gem?username=X — Hidden Gem Mode (Use Case 4)
// Low popularity + verified MusicBrainz studio album = hidden gem.
// (No rating_score in the new schema; MB presence is the quality signal.)

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username');

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    const db = context.env.DB;

    // Hidden gem: low popularity, has MusicBrainz ID (quality indicator)
    let album = await db
      .prepare(
        `SELECT al.id, al.title, al.release_year, al.cover_art_url,
                al.popularity_score, ar.name AS artist_name, ar.country,
                GROUP_CONCAT(DISTINCT g.name) AS genre
         FROM albums al
         JOIN artists ar ON al.artist_id = ar.id
         LEFT JOIN album_genres ag ON al.id = ag.album_id
         LEFT JOIN genres g ON ag.genre_id = g.id
         WHERE al.popularity_score < 25
         AND al.musicbrainz_release_group_id IS NOT NULL
         AND al.id NOT IN (SELECT album_id FROM UserAlbum WHERE username = ?)
         GROUP BY al.id
         ORDER BY RANDOM() LIMIT 1`
      )
      .bind(username)
      .first();

    if (!album) {
      // Relax threshold
      album = await db
        .prepare(
          `SELECT al.id, al.title, al.release_year, al.cover_art_url,
                  al.popularity_score, ar.name AS artist_name, ar.country,
                  GROUP_CONCAT(DISTINCT g.name) AS genre
           FROM albums al
           JOIN artists ar ON al.artist_id = ar.id
           LEFT JOIN album_genres ag ON al.id = ag.album_id
           LEFT JOIN genres g ON ag.genre_id = g.id
           WHERE al.popularity_score < 50
           AND al.id NOT IN (SELECT album_id FROM UserAlbum WHERE username = ?)
           GROUP BY al.id
           ORDER BY RANDOM() LIMIT 1`
        )
        .bind(username)
        .first();

      if (!album) {
        return Response.json(
          { error: 'No hidden gems left to discover!', noResults: true },
          { status: 404 }
        );
      }
    }

    return Response.json({ album });
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
