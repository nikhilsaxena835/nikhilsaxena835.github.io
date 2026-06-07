// GET /api/history?username=X — Fetch user's interaction history
// Updated for normalized schema (artists + album_genres + genres tables).

const ALBUM_SELECT = `
  SELECT ua.status, ua.timestamp,
         al.id, al.title, al.release_year, al.cover_art_url, al.popularity_score,
         ar.name AS artist_name, ar.country,
         GROUP_CONCAT(DISTINCT g.name) AS genre
  FROM UserAlbum ua
  JOIN albums al ON ua.album_id = al.id
  JOIN artists ar ON al.artist_id = ar.id
  LEFT JOIN album_genres ag ON al.id = ag.album_id
  LEFT JOIN genres g ON ag.genre_id = g.id
  WHERE ua.username = ?
  GROUP BY al.id
  ORDER BY ua.timestamp DESC`;

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username');

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    const db = context.env.DB;
    const results = await db.prepare(ALBUM_SELECT).bind(username).all();

    const liked = [];
    const disliked = [];
    const skipped = [];

    for (const row of results.results) {
      const album = {
        id: row.id,
        title: row.title,
        artist_name: row.artist_name,
        release_year: row.release_year,
        country: row.country,
        genre: row.genre,
        cover_art_url: row.cover_art_url,
        timestamp: row.timestamp,
      };
      if (row.status === 'LIKED') liked.push(album);
      else if (row.status === 'DISLIKED') disliked.push(album);
      else if (row.status === 'SKIPPED') skipped.push(album);
    }

    return Response.json({ liked, disliked, skipped });
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
