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

    // ── Diagnostic: check both FK targets before inserting ──
    const userRow = await db
      .prepare('SELECT username FROM User WHERE username = ?')
      .bind(lowerUser)
      .first();

    const albumRow = await db
      .prepare('SELECT id FROM albums WHERE id = ?')
      .bind(album_id)
      .first();

    if (!userRow || !albumRow) {
      return Response.json({
        error: `FK pre-check failed. user "${lowerUser}" found: ${!!userRow}, album_id ${album_id} found: ${!!albumRow}`,
        debug: { userRow, albumRow, sentUsername: username, sentAlbumId: album_id }
      }, { status: 400 });
    }

    // ── If both exist, proceed with the insert ──
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
