# World Album Discovery — Architecture & Walkthrough

## 🌍 What Is It?
A museum-curator-style music explorer that surfaces culturally diverse, historically important albums from around the world. It bypasses modern algorithms and taste profiling, allowing users to discover Japanese city pop, Pakistani qawwali, or Brazilian jazz through pure randomness, geography, and curation.

## 🏗 Architecture Summary

The feature is built within the existing portfolio site repository but operates with its own dedicated backend infrastructure using Cloudflare Pages, Functions, D1, and KV.

```mermaid
graph TD
    A["tools/album-discovery/index.html<br/>(Browser)"] -->|fetch /api/album-discovery/*| B["Cloudflare Pages Functions<br/>(functions/api/album-discovery/*.js)"]
    B -->|SQL queries| C["Cloudflare D1<br/>(SQLite)"]
    B -->|Cache filters| D["Cloudflare KV"]
    E["seed.js<br/>(Local Node.js)"] -->|Generates seed.sql| C
    F["Wikidata + Last.fm + MusicBrainz"] -->|Album data| E
```

---

## 📂 What Was Built

### 1. Infrastructure
| File | Purpose |
|------|---------|
| `wrangler.toml` | Cloudflare Pages config with D1 (Database) + KV (Cache) bindings. |
| `tools/album-discovery/data/schema.sql` | Fully normalized D1 database schema: `countries`, `artists`, `albums`, `genres`, `users`, and junction tables. |

### 2. Backend — 9 API Routes (Cloudflare Pages Functions)
Located in `functions/api/album-discovery/`, these are automatically routed by Cloudflare.
| File | Route | Purpose |
|------|-------|---------|
| `user.js` | `POST /api/album-discovery/user` | Create or login user by username. |
| `history.js` | `GET /api/album-discovery/history` | Fetch liked/disliked/skipped albums for a user. |
| `interact.js`| `POST /api/album-discovery/interact` | Record a like/dislike/skip interaction. |
| `daily.js` | `GET /api/album-discovery/daily` | Returns a daily album (deterministic, same for all users). |
| `discover.js`| `GET /api/album-discovery/discover` | Filtered random discovery based on user parameters. |
| `world-tour.js`| `GET /api/album-discovery/world-tour`| Country rotation passport mode. |
| `hidden-gem.js`| `GET /api/album-discovery/hidden-gem`| Returns high-rating, low-popularity albums. |
| `filters.js` | `GET /api/album-discovery/filters` | Available countries/genres/decades for dropdowns (Cached in KV). |
| `stats.js` | `GET /api/album-discovery/stats` | Cultural passport statistics for the dashboard. |

### 3. Frontend — The Music App (SPA)
| File | Purpose |
|------|---------|
| `tools/album-discovery/index.html` | Entry point with 3 views (onboarding, dashboard, session). |
| `tools/album-discovery/album-discovery.css` | Styles matching portfolio aesthetic (black, coral, dot-grid, minimal). |
| `tools/album-discovery/album-discovery.js` | SPA logic: state machine, API client, rendering, localStorage persistence. |

### 4. Data Curation Pipeline
| File | Purpose |
|------|---------|
| `tools/album-discovery/data/seed/getArtists.py` | Extracts musicians by country from Wikidata via SPARQL, saving them locally. |
| `tools/album-discovery/data/seed/seed.js` | Reads Wikidata exports, validates with Last.fm (strictly filtering by `MIN_LISTENERS` to reject actors), queries MusicBrainz for album data, and outputs `seed.sql`. |

---

## 🚀 How to Run & Deploy

> [!IMPORTANT]
> The code is complete but the Cloudflare infrastructure needs to be connected for the backend to function.

### Step-by-step Setup:

```bash
# 1. Install wrangler and login
npm install -g wrangler
wrangler login

# 2. Create Cloudflare Pages project
#    Dashboard → Workers & Pages → Create → Pages → Connect to Git
#    Select your repo. Build output directory: /

# 3. Create D1 database
npx wrangler d1 create world-album-db
# → Copy the database_id into wrangler.toml

# 4. Create KV namespace  
npx wrangler kv namespace create CACHE
# → Copy the id into wrangler.toml

# 5. Apply database schema
npx wrangler d1 execute world-album-db --remote --file=tools/album-discovery/data/schema.sql

# 6. Run seed script (generates seed.sql via data pipeline)
cd tools/album-discovery/data/seed && node seed.js && cd ../../../..

# 7. Load seed data into production
npx wrangler d1 execute world-album-db --remote --file=tools/album-discovery/data/seed/seed.sql

# 8. Test locally
npx wrangler pages dev .

# 9. Open http://localhost:8788/tools/album-discovery/
```

### After Cloudflare Pages is connected:
- Every `git push` auto-deploys the entire site.
- Your portfolio (`index.html`) continues working as before.
- The music app lives at `yourdomain.com/tools/album-discovery/`.
