# Generala

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) — Licencia MIT, ver [LICENSE](LICENSE).

Generala / Yahtzee para la tele: la TV (Fire TV, Vega) muestra la mesa y los celulares de los jugadores son los controles, desde el navegador, escaneando un QR.

## Estructura

- `shared/` — `engine.js` (reglas, funciones puras) e `i18n.js` (textos es / en). Se editan solo acá; `node scripts/sync-shared.mjs` los copia a `backend/shared/` y `tv/src/shared/`.
- `backend/` — proyecto de Vercel: API serverless (`api/`, lógica en `lib/`), control web del celular y anfitrión web para depurar (Vite + React), esquema de Supabase. Ver `backend/README.md`.
- `tv/` — app de Fire TV (Vega / React Native): el anfitrión.
- `docs/ARCHITECTURE.md` — contrato de la API y del estado de la sala.

## Probar rápido (local)

```bash
cd backend && npm install && npm run dev
```

Abrí `http://localhost:5173/?surface=tv` para crear una sala y escaneá el QR con el celular (misma Wi-Fi). Sin Supabase configurado la API usa un store en memoria.
