# Portfolio Website — Deployment & Infrastructure Guide

## 🏗 Architecture Overview

This repository hosts my personal portfolio website and various interactive tools. 
Historically, this site was hosted on GitHub Pages with Cloudflare acting purely as a DNS/CDN proxy. However, to support serverless backends, databases, and edge caching for new interactive features, the entire site is natively hosted on **Cloudflare Pages**.

The portfolio leverages the following Cloudflare ecosystem components:
- **Cloudflare Pages**: Hosts the static frontend (`index.html`, CSS, JS, images) natively.
- **Cloudflare Pages Functions**: Serverless API routes (located in `functions/api/<tool-name>/`) that execute at the edge.
- **Cloudflare D1**: Serverless SQLite databases for structured data storage (e.g., app data, user history).
- **Cloudflare KV**: Global key-value data store used for fast edge caching.

---

## 🚀 One-Time Migration: GitHub Pages to Cloudflare Pages

To enable the backend features, the site must be migrated from GitHub Pages to Cloudflare Pages. This is a one-time setup process.

### 1. Install & Authenticate Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```
*This will open your browser to authenticate with your Cloudflare account.*

### 2. Create the Cloudflare Pages Project
1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select the `nikhilsaxena835.github.io` repository.
3. **Framework preset**: `None`.
4. **Build output directory**: `/` (since the static files are at the root).
5. Click **Save and Deploy**.
*You will receive a `*.pages.dev` URL. The site now deploys directly from Cloudflare Pages.*

### 3. Migrate the Custom Domain
1. In the new Cloudflare Pages project, go to **Custom domains** → **Add your domain**.
2. Since your domain is already using Cloudflare's nameservers, it will auto-update the DNS records to point to Pages instead of GitHub.
3. **Important**: Go to your GitHub repository settings (**Settings** → **Pages**) and set **Source** to **None** to disable GitHub Pages and prevent conflicts.

---

## ⚙️ Initializing Backend Infrastructure

For tools that require a backend (databases, caches), you need to provision the specific Cloudflare resources and link them to the project via `wrangler.toml`.

### 1. Create a D1 Database
```bash
npx wrangler d1 create <database-name>
```
*This will output a `database_id`. Paste this ID into the `[[d1_databases]]` section of your `wrangler.toml`.*

### 2. Create a KV Namespace
```bash
npx wrangler kv namespace create <cache-name>
```
*This will output an `id`. Paste this ID into the `[[kv_namespaces]]` section of your `wrangler.toml`.*

---

## 🔄 Continuous Deployment & Daily Workflow

### Production Deployments
Because Cloudflare Pages is connected directly to this repository:
- **Every `git push` to the `main` branch automatically triggers a full deployment.**
- The static files are deployed globally.
- The scripts inside `functions/` are automatically bundled and deployed as edge serverless workers.

### Database Updates
While code deploys automatically, database schema changes or data seeds must be executed manually via Wrangler:
```bash
# Execute a SQL file against a production D1 database
npx wrangler d1 execute <database-name> --remote --file=path/to/file.sql
```

### Local Development
To run the entire stack locally (Frontend + Functions + Local D1/KV) before pushing:
```bash
# Start the local development server
npx wrangler pages dev .
```
This simulates the Cloudflare edge environment locally, routing your `/api/*` endpoints correctly and providing access to local database instances.
