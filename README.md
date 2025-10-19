# LeetCode Automation

Automation toolkit for the LeetCode Problem of the Day (POTD). The project bundles a FastAPI backend, a Vite + React frontend, and an optional Chrome extension that bridges authenticated cookies from a live LeetCode session.

## Repository layout

```
backend/    FastAPI service that proxies POTD data and curated references.
frontend/   Vite + React dashboard for browsing the daily challenge.
extension/  Chrome extension to securely hand over the LEETCODE_SESSION + csrftoken cookies.
```

Each subproject ships with its own README containing deeper instructions.

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
