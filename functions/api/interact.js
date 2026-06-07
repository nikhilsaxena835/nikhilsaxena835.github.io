// POST /api/interact — Record a user-album interaction (LIKED, DISLIKED, SKIPPED)
export async function onRequestPost(context) {
  try {
    const { username, album_id, status } = await context.request.json();

    if (!username || !album_id || !['LIKED', 'DISLIKED', 'SKIPPED'].includes(status)) {
      return Response.json(
        { error: 'Required: username, album_id, status (LIKED|DISLIKED|SKIPPED)' },
        { status: 400 }
      );
    }

    const db = context.env.DB;
    const lowerUser = username.toLowerCase();

    await db
      .prepare(
        'INSERT OR REPLACE INTO UserAlbum (username, album_id, status) VALUES (?, ?, ?)'
      )
      .bind(lowerUser, album_id, status)
      .run();

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
