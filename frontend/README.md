# LeetCode POTD Dashboard

A lightweight Vite + React + TypeScript web app for tracking the LeetCode Problem of the Day (POTD), picking a preferred language, and jumping straight to curated references—without embedding any third-party solution code.

## Features
- Fetches the current POTD from your backend (`GET /api/potd`).
- Filters reference links by language via (`GET /api/references?slug=<slug>&lang=<language>`).
- Uses TanStack Query for data fetching, caching, and retries.
- Tailwind CSS styling with responsive, accessible components.

## Prerequisites
- Node.js 18+
- npm 9+
- Backend API reachable at `http://localhost:8000` or configure via environment variable.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and adjust as needed:
   ```bash
   cp .env.example .env
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Visit the app at [http://localhost:5173](http://localhost:5173).

## Configuration
- `VITE_API_BASE` (default: `http://localhost:8000`): Base URL for the backend API.

## Available Scripts
- `npm run dev` – Start Vite in development mode.
- `npm run build` – Type-check and build for production.
- `npm run preview` – Preview the production build locally.

## Project Structure
```
frontend/
  src/
    components/     // UI building blocks (cards, pickers, lists)
    lib/            // API client and type definitions
    pages/          // Route-level components
```

## Notes
- The app only renders metadata and links for references—no solution code is fetched or displayed.
- Ensure your FastAPI backend enables CORS for `http://localhost:5173` to allow browser requests during development.
- To deploy on GitHub Pages, push to `main` and the `deploy-frontend.yml` workflow will build the site with the
  `https://<your-username>.github.io/dailycodepush/` base path.
