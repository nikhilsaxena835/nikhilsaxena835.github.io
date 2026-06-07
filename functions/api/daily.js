// GET /api/daily?username=X — Daily Album (Use Case 1)
// Same album for everyone each day, excludes albums the user already interacted with.

const ALBUM_QUERY = `
  SELECT al.id, al.title, al.release_year, al.cover_art_url,
         al.popularity_score, al.musicbrainz_release_group_id,
         ar.name AS artist_name, ar.country,
         GROUP_CONCAT(DISTINCT g.name) AS genre
  FROM albums al
  JOIN artists ar ON al.artist_id = ar.id
  LEFT JOIN album_genres ag ON al.id = ag.album_id
  LEFT JOIN genres g ON ag.genre_id = g.id`;

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username');

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    const db = context.env.DB;
    const today = new Date().toISOString().split('T')[0];

    // Deterministic hash of date → offset
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = ((hash << 5) - hash + today.charCodeAt(i)) | 0;
    }
    hash = Math.abs(hash);

    const countRow = await db.prepare('SELECT COUNT(*) as count FROM albums').first();
    if (!countRow || countRow.count === 0) {
      return Response.json({ error: 'No albums in database' }, { status: 404 });
    }

    const offset = hash % countRow.count;
    const dailyAlbum = await db
      .prepare(`${ALBUM_QUERY} WHERE al.id = (SELECT id FROM albums LIMIT 1 OFFSET ?) GROUP BY al.id`)
      .bind(offset)
      .first();

    if (!dailyAlbum) {
      return Response.json({ error: 'No albums available' }, { status: 404 });
    }

    // Check if user already interacted
    const interaction = await db
      .prepare('SELECT status FROM UserAlbum WHERE username = ? AND album_id = ?')
      .bind(username, dailyAlbum.id)
      .first();

    if (interaction) {
      const fallback = await db
        .prepare(
          `${ALBUM_QUERY}
           WHERE al.id NOT IN (SELECT album_id FROM UserAlbum WHERE username = ?)
           GROUP BY al.id
           ORDER BY RANDOM() LIMIT 1`
        )
        .bind(username)
        .first();

      if (!fallback) {
        return Response.json({
          album: dailyAlbum,
          alreadySeen: true,
          message: "You've explored every album in the collection!",
        });
      }
      return Response.json({ album: fallback, isFallback: true });
    }

    return Response.json({ album: dailyAlbum });
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
