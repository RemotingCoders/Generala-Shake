# Generala

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) — MIT License, see [LICENSE](LICENSE).

Generala / Yahtzee for the living-room TV: the TV (Fire TV, Vega OS) shows the table and the players' phones are the controllers, from the browser, by scanning a QR code.

## Layout

- `shared/` — `engine.js` (rules, pure functions) and `i18n.js` (es / en strings). Edit them only here; `node scripts/sync-shared.mjs` copies them into `backend/shared/` and `tv/src/shared/`.
- `backend/` — Vercel project: serverless API (`api/`, logic in `lib/`), the phone web controller and a web host for debugging (Vite + React), Supabase schema. See `backend/README.md`.
- `tv/` — Fire TV app (Vega OS / React Native): the host.
- `docs/ARCHITECTURE.md` — API contract and room state.

## Quick start (local)

```bash
cd backend && npm install && npm run dev
```

Open `http://localhost:5173/?surface=tv` to create a room and scan the QR code with your phone (same Wi-Fi). Without Supabase configured the API uses an in-memory store.
