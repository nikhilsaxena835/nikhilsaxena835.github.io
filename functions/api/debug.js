export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username') || '';
    const album_id = url.searchParams.get('album_id') || '';
    
    const db = context.env.DB;
    
    const userRow = await db.prepare('SELECT * FROM User WHERE username = ?').bind(username.toLowerCase()).first();
    const albumRow = await db.prepare('SELECT id FROM albums WHERE id = ?').bind(album_id).first();
    
    return Response.json({
      userFound: !!userRow,
      albumFound: !!albumRow,
      user: userRow,
      album: albumRow
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
