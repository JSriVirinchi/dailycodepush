# LeetCode Automation

Automation toolkit for the LeetCode Problem of the Day (POTD). The project bundles a FastAPI backend, a Vite + React frontend, and an optional Chrome extension that bridges authenticated cookies from a live LeetCode session.

## Repository layout

```
backend/    FastAPI service that proxies POTD data and curated references.
frontend/   Vite + React dashboard for browsing the daily challenge.
extension/  Chrome extension to securely hand over the LEETCODE_SESSION + csrftoken cookies.
```

Each subproject ships with its own README containing deeper instructions.

## Deployment

The repository now includes infrastructure to publish the dashboard end-to-end:

- **Frontend** – A GitHub Actions workflow (`deploy-frontend.yml`) builds the Vite app and deploys it to GitHub Pages. Set the
  repository variable `PRODUCTION_API_BASE` to the HTTPS URL of your backend (for example, the Render service below) and push to
  `main` to trigger a release. The workflow automatically adjusts the Vite base path so the static assets load from
  `https://<your-username>.github.io/dailycodepush/`.
- **Backend** – A Dockerfile and Render blueprint (`render.yaml`) describe a containerized FastAPI service. Connect your
  Render account to this repository, or supply `RENDER_SERVICE_ID` and `RENDER_API_KEY` secrets so the
  `deploy-backend.yml` workflow can trigger deployments after it publishes the image to GitHub Container Registry.

Once both services are live, update `frontend/.env` (or a Pages variable) so the frontend points at the hosted API and add the
resulting GitHub Pages origin to the backend’s `FRONTEND_ORIGINS` environment variable.

## Prerequisites

- Python 3.11+ (recommended) with `venv`
- Node.js 18+ and npm 9+
- Chrome (only if you plan to use the extension)

## Quick start

1. **Backend**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env  # optional: add LEETCODE_SESSION + LEETCODE_CSRF_TOKEN
   uvicorn app.main:app --reload --port 8000
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env  # optional: point VITE_API_BASE to a deployed backend
   npm run dev
   ```

   Visit http://localhost:5173 once both servers are running.

3. **Chrome extension (optional)**
   - Open `chrome://extensions`, enable *Developer mode*, and choose **Load unpacked**.
   - Select the `extension/` directory.
   - On the dashboard, click "Fetch from extension" to pass the authenticated cookies to the backend.

## Environment variables

Sensitive values are never committed; use the provided templates instead:

- `backend/.env.example` – allowed origins, default user agent, optional LeetCode credentials.
- `frontend/.env.example` – base URL for the backend API.

Copy the template to `.env` for each service and set your local secrets there.

## Development tips

- The backend exposes `GET /api/potd` and `GET /api/references` endpoints plus a `/health` probe.
- The frontend uses TanStack Query and Tailwind CSS; update the `frontend/src` modules as needed.
- The extension only requests cookie access for `leetcode.com` and communicates via `postMessage`.

## License

No license has been declared yet. Add one before publishing if you intend to open-source the project.
