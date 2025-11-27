# SEO & GEO Analyzer – Backend

This repository hosts the Express backend that powers Lighthouse runs via the PageSpeed Insights API. The frontend now lives separately (reqs-to-reality-bot) and connects through `VITE_API_BASE` to this service.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `apps/backend/.env` from the example:

```
GOOGLE_API_KEY=your_pagespeed_insights_api_key
CORS_ORIGIN=https://dream-seo-geo.netlify.app
PORT=4000
```

`GOOGLE_API_KEY` (or `PSI_API_KEY`) is required for PSI calls. Add any additional frontend origins to `CORS_ORIGIN` (comma-separated). The frontend repo should point `VITE_API_BASE` to this API.

### 3. Run in development

```bash
npm run dev
```

API will listen on http://localhost:4000 (configurable via `PORT`).

### 4. Build for production

```bash
npm run build
npm run start
```

Build compiles backend TypeScript to `apps/backend/dist` and starts `node apps/backend/dist/index.js`.

### 5. Deploy

Deploy to Render/Railway/Fly/etc. Provide `GOOGLE_API_KEY`, `CORS_ORIGIN` (include your frontend origin such as Netlify), and `PORT` if required by your host.

## Backend API

- `GET /api/health` → `{ ok: true, service: "seo-geo-analyzer-api", time }`
- `POST /api/lighthouse-runs` with `{ url }` → `{ ok: true, url, lighthouse }`
- `GET /api/lighthouse-runs/latest?url=...` → `{ ok: true, url, lighthouse }`

The frontend (reqs-to-reality-bot) should call these endpoints via `VITE_API_BASE` pointing at this service.
