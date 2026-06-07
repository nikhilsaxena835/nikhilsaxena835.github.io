# Product Specification: World Album Discovery

## Overview

Build a web application that helps users discover great music albums from around the world without personalization.

The core philosophy is:

* No recommendation algorithms.
* No collaborative filtering.
* No "because you listened to X" suggestions.
* No user taste profiling.
* No engagement optimization.

The application should behave more like a museum curator than a streaming recommendation engine.

The goal is to expose users to culturally diverse, historically important, critically acclaimed, and interesting albums from many countries, languages, eras, and genres.

A user should be able to discover Japanese city pop one day, Pakistani qawwali the next day, Brazilian jazz after that, and Korean indie the day after, regardless of previous listening behavior.

**Primary Entry Point:** `get_music.html`

---

# User Flow

1. **Onboarding & Explanation:** User opens `get_music.html`. The page clearly explains what the website does: curates global music without algorithms or engagement traps.
2. **Identity Setup:** The user is asked to enter a unique "username" (no passwords, just a unique string identifier).
3. **Dashboard & History:** Using this username, the system fetches their details from the cloud database. The user is presented with their dashboard showing:
    * Previously listened and liked albums.
    * Skipped albums.
    * Options to start a new discovery session based on different modes.
4. **Discovery Session:** The user enters a discovery mode, is presented with an album, and can take actions (Listen, Like, Skip) which immediately sync back to the cloud.

---

# Primary Use Cases

## Use Case 1: Daily Album
System generates one random album for the day. User can listen, mark as liked, skip, or save. No personalization occurs based on their history, other than excluding albums they've already interacted with.

## Use Case 2: Filtered Discovery
User selects Countries, Decades, and Genres. System randomly selects a qualifying album from the database.

## Use Case 3: World Tour
System automatically rotates countries based on the user's "Cultural Passport" history stored in the cloud. The same country should not appear again until all selected countries have been visited by that specific user.

## Use Case 4: Hidden Gem Mode
Only show albums that satisfy a high rating threshold but a low popularity threshold. Surfaces lesser-known albums.

---

# Product Principles

## Must Have
* Album-first and Country-first exploration.
* No personalization. Diversity over similarity.
* Cloud-stored user history via unique username.

## Must Not Have
* Machine learning ranking or Collaborative filtering.
* "Recommended for you" based on taste.

---

# Data Sources (External APIs)
* **MusicBrainz API:** Album, artist, country, release metadata.
* **Cover Art Archive:** Album artwork (Free API: https://coverartarchive.org).
* **Wikipedia API:** Album descriptions and historical context.

---

# Architecture & Technical Stack

The application leverages an "Edge + Static" architecture to keep hosting free, fast, and simple.

* **Frontend:** Pure HTML5, CSS3, and Vanilla JavaScript. No frameworks (No Next.js or React).
* **Backend API:** **Cloudflare Pages Functions**. 
  * *Why:* Pages Functions (`functions/` directory) live right next to your static HTML/CSS files in the repository. When you deploy to Cloudflare Pages, it automatically creates serverless API routes based on the file structure. It's the absolute best choice for a hobby project because it requires zero complex setup, but leaves room to add more standalone Workers later if needed.
* **Database:** **Cloudflare D1** (Serverless SQLite). Perfect for relational data (Albums, Users, Genres) and accessed instantly from the Pages Functions.
* **Caching:** **Cloudflare KV** (Key-Value store). Used to cache responses from MusicBrainz or Wikipedia to ensure fast loads and prevent hitting API rate limits.

---

# Data Model (Cloudflare D1 SQLite)

**Album**
`id` (Primary Key, matches MusicBrainz ID)
`title`, `artist_name`, `release_year`, `country`, `language`, `genre`
`cover_art_url`, `description`, `popularity_score`, `rating_score`

**User**
`username` (Primary Key, unique string)
`created_at`

**UserAlbum (Junction Table for History)**
`username` (Foreign Key)
`album_id` (Foreign Key)
`status` (Values: 'LISTENED', 'LIKED', 'SKIPPED')
`timestamp`

---

# Discovery Engine Logic

The application should not rank albums by user preference. 
Instead, the Pages Function queries the D1 database:

```sql
SELECT * FROM Album 
WHERE country = 'Japan' 
AND id NOT IN (SELECT album_id FROM UserAlbum WHERE username = 'user123')
ORDER BY RANDOM() LIMIT 1;
```

---

# Database Update Strategy (Future Releases)

Since we are relying on a predefined database of albums to ensure fast, algorithm-free random querying, we need a way to keep the catalog fresh with new releases.

**Proposed Solution: Scheduled Cron Worker**
1. We will create a separate, small Cloudflare Worker script called `catalog-updater`.
2. Using Cloudflare's `Cron Triggers` (configured in `wrangler.toml`), this script runs automatically once a week (e.g., Sunday at midnight).
3. The script calls the MusicBrainz API, searching for highly-rated releases from the past week across our supported countries.
4. It parses the results and runs `INSERT OR IGNORE` SQL queries into our Cloudflare D1 database.
5. This ensures the static database grows autonomously over time without any manual admin work.

---

# Initial Seed Strategy
Before launch, a one-off local Node/Python script will be executed by the developer to pull ~10,000 top albums from target countries via MusicBrainz and insert them into the Cloudflare D1 database.

---

# Success Metric
Users regularly discover albums they would never have found through standard streaming recommendation systems, and build a diverse "Cultural Passport" stored under their username.
