// POST /api/user — Create or login user by username
export async function onRequestPost(context) {
  try {
    const { username } = await context.request.json();

    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return Response.json(
        { error: 'Invalid username. Use 3–20 alphanumeric characters or underscores.' },
        { status: 400 }
      );
    }

    const db = context.env.DB;
    const lower = username.toLowerCase();

    const existing = await db
      .prepare('SELECT username, created_at FROM User WHERE username = ?')
      .bind(lower)
      .first();

    if (existing) {
      return Response.json({ user: existing, isNew: false });
    }

    await db.prepare('INSERT INTO User (username) VALUES (?)').bind(lower).run();

    const user = await db
      .prepare('SELECT username, created_at FROM User WHERE username = ?')
      .bind(lower)
      .first();

    return Response.json({ user, isNew: true });
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
