Backend on Render
1) New ? Web Service ? connect repo DesignDreamAshu/seo-geo-analyzer
2) Root Directory = apps/backend
3) Build Command = npm install
4) Start Command = node index.js
5) Env vars:
   - PORT=4000
   - CORS_ORIGIN=https://<netlify-site>.netlify.app
  - GOOGLE_API_KEY=AIzaSyCqu9AFl77Az00YWFye1zIhen7kDZHu74o
6) Deploy, then test GET /api/health
7) Set Auto Deploy=Yes and delete any legacy service that targets DreamIcons/dreamicons-app-backend.

Frontend on Netlify
1) New site from Git
2) Build command: npm --workspace apps/frontend run build
3) Publish directory: apps/frontend/dist
4) Env var: VITE_API_BASE=https://<render-service>.onrender.com (always match the live Render URL)
5) Deploy and test

Local dev
- From repo root: npm run dev
- Frontend: http://localhost:8080 ? proxies /api to http://localhost:4000
