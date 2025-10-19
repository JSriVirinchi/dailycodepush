# Backend – LeetCode Automation API

A FastAPI backend that powers the LeetCode POTD dashboard. It proxies the Problem of the Day from LeetCode’s public GraphQL endpoint and exposes curated reference links for each problem.

## Features
- `GET /api/potd` – Fetches the current LeetCode Problem of the Day.
- `GET /api/references?slug=<slug>&lang=<language>` – Returns links for the official editorial and most-voted community solutions scoped by language.
- CORS configured for the Vite frontend (`http://localhost:5173` by default).

## Setup
1. Create a virtual environment (recommended) and install dependencies:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Configure environment variables (optional):
   ```bash
   cp .env.example .env
   ```
   - `FRONTEND_ORIGINS` – Comma-separated list of allowed origins for CORS. Defaults to `http://localhost:5173`.
   - `LEETCODE_USER_AGENT` – User agent header used when communicating with LeetCode.
   - `LEETCODE_SESSION` *(optional)* – Session cookie to access gated community solutions.
   - `LEETCODE_CSRF_TOKEN` *(optional)* – CSRF token paired with the session cookie.

3. Launch the API:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

## Deployment
- A production-ready Dockerfile lives in `backend/Dockerfile`.
- The root `render.yaml` blueprint provisions a Render web service from that container; connect your repository in Render or
  provide `RENDER_SERVICE_ID` and `RENDER_API_KEY` secrets for the GitHub Actions workflow to trigger deployments.

## API Reference
- `GET /health` – Basic readiness probe.
- `GET /api/potd` – Returns the Problem of the Day payload.
- `GET /api/references` – Requires `slug` query parameter and optional `lang`. Returns editorial and community solution links as well as the highest-voted community solution code snippet (when available).

## Notes
- Only metadata and outbound links are returned—no solution code is stored or served.
- Ensure outbound HTTPS requests to `https://leetcode.com/graphql` are allowed from your network.
