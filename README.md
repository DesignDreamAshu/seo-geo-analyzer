# SEO & GEO Analyzer Monorepo

A full-stack PageSpeed observability starter that pairs a modern Vite + React dashboard with an optimized Express API for running Google Lighthouse (PageSpeed Insights) audits.

## Highlights

- **Fast audits with caching** - validated inputs, PSI timeouts, and in-memory caching keep responses quick.
- **Actionable UI** - the React client surfaces category scores, Core Web Vitals, top opportunities, real-user field data, and audit history.
- **Production-ready defaults** - Helmet, CORS allowlists, rate limiting, env-driven config, and a keep-alive workflow.
- **Workspaces ergonomics** - npm workspaces keep frontend, backend, and future shared packages organized.

## Stack Overview

- **Package management**: npm workspaces (`apps/*`, `packages/*`)
- **Frontend**: Vite + React + TypeScript (port `8080`)
- **Backend**: Express (ESM) with CORS, Helmet, Morgan, express-rate-limit, dotenv (port `4000`)
- **Automation**: GitHub Actions keep-alive workflow (curls `${{ secrets.HEALTH_URL }}` every 10 minutes)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `apps/backend/.env` from the example:

```
PORT=4000
CORS_ORIGIN=http://localhost:8080
PSI_API_KEY=your-google-pagespeed-api-key
PSI_TIMEOUT_MS=15000
PSI_CACHE_TTL_MS=300000
PSI_LOCALE=en_US
PSI_CATEGORIES=performance,seo,best-practices,accessibility
PSI_MAX_OPPORTUNITIES=5
```

For the frontend, set `VITE_API_BASE=https://your-production-api.com` in deployment environments. During local development the app falls back to relative `/api` calls via the Vite dev proxy.

### 3. Run in development

```bash
npm run dev
```

This starts:

- Vite dev server on http://localhost:8080 with a proxy for `/api`
- Express API on http://localhost:4000

### 4. Build for production

```bash
npm run build
```

- Frontend output: `apps/frontend/dist`
- Backend build is a no-op (plain Node.js). Deploy `apps/backend/src/server.js` as-is or bundle with your preferred tooling.

### 5. Deploy

1. Deploy the backend (Render, Railway, Fly.io, etc.). Provide `PORT`, `CORS_ORIGIN`, `PSI_API_KEY`, and optional PSI tuning variables.
2. Configure a keep-alive scheduler (GitHub Actions workflow included) with a secret `HEALTH_URL` pointing to `https://your-api.com/api/health`.
3. Build the frontend (`npm run build --workspace apps/frontend`) and host the static files (Netlify, Vercel, S3/CloudFront, etc.). Set `VITE_API_BASE` at build time to your deployed API origin.

## Deployment

- **Netlify frontend**
  - Set environment variable `VITE_API_BASE=https://<render-service>.onrender.com`
  - Build command: `npm --workspace apps/frontend run build`
  - Publish directory: `apps/frontend/dist`

## Backend API

- `GET /api/health` - lightweight health probe used by the UI and the keep-alive workflow.
- `POST /api/audit/lighthouse`
  - **Body**: `{ url: string, strategy?: "mobile" | "desktop", locale?: string, skipCache?: boolean }`
  - **Response**: `{ categories[], metrics[], opportunities[], fieldData, psiMeta, cached }`
  - Includes category scores, lab metrics, top opportunity savings, page/origin field data, and metadata from PSI. Requires `PSI_API_KEY`.

## Frontend Notes

- Uses `import.meta.env.VITE_API_BASE` when building. In dev it defaults to an empty string so requests are sent to the same origin and proxied to `http://localhost:4000`.
- The dashboard (`apps/frontend/src/App.tsx`) includes form validation, audit history, Core Web Vitals cards, top opportunity tables, and field data visualizations shaped for the API response.

## Repository Structure

```
.
|- apps
|  |- backend      # Express API
|  \- frontend     # Vite + React client
|- packages        # Shared workspace packages (placeholder)
|- .github/workflows
|- package.json
\- README.md
```

Happy shipping!
