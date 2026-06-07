// GET /api/filters — Available filter options for the UI
// Returns distinct countries (from artists), genres, and decades. Cached in KV.

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const cache = context.env.CACHE;

    if (cache) {
      const cached = await cache.get('filters', { type: 'json' });
      if (cached) return Response.json(cached);
    }

    // Countries come from artists table (seeding country)
    const countries = await db
      .prepare('SELECT DISTINCT country FROM artists WHERE country IS NOT NULL ORDER BY country')
      .all();

    // Genres from normalized table
    const genres = await db
      .prepare('SELECT DISTINCT name FROM genres ORDER BY name')
      .all();

    // Decades from albums
    const decades = await db
      .prepare(
        'SELECT DISTINCT (release_year / 10 * 10) as decade FROM albums WHERE release_year IS NOT NULL ORDER BY decade'
      )
      .all();

    const result = {
      countries: countries.results.map((r) => r.country),
      genres: genres.results.map((r) => r.name),
      decades: decades.results.map((r) => r.decade).filter((d) => d != null),
    };

    if (cache) {
      await cache.put('filters', JSON.stringify(result), { expirationTtl: 86400 });
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
