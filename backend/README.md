# Generala · backend + phone controller

Vercel project: serverless API (`api/`), phone controller (Vite + React) and a web TV host for debugging. Full contract in `../docs/ARCHITECTURE.md`.

- `/` — phone controller (what the QR code opens: `/?room=CODE`).
- `/?surface=tv` (or `/tv`) — web host: create room, QR, start, pause, results. Driven with the arrow keys, Enter and Backspace. It is a fallback for debugging; the real host is the Fire TV app.
- `/api/*` — API (see the contract).

## Local development

```bash
cd backend
npm install
npm run dev                  # http://0.0.0.0:5173 (web + /api together)
npm run dev -- --port 5180   # another port
npm test                     # full games against the API (in-memory store)
npm run build
```

Without the Supabase variables the API uses an in-memory store (lost on restart, no Realtime; clients poll every 1 s). In dev, the QR code uses the LAN IP instead of `localhost` so the phone can open it (same Wi-Fi).

The rules (`shared/engine.js`, `shared/i18n.js`) and the 3D dice (`shared/dice3d/`) are edited in the root `shared/` folder and copied with `node scripts/sync-shared.mjs` (or `npm run sync` from `backend/`). Do not edit `backend/shared/` or `backend/public/dice3d/` by hand.

## Shaking and 3D dice

- Phone: holding **Roll** (or shaking the phone, with the motion permission) sends `play {action:'shake', active:true}`; releasing (or when the phone comes to rest) sends `roll`. A short tap rolls right away. Detection uses `ShakeDetector` from `shared/dice3d/motion-engine.js`.
- After each roll the phone hides the new dice for `DICE_SETTLE_MS` (5 s, the time they take to land on the TV); held dice stay visible. Only then can dice be held or a category scored.
- Web TV (`/?surface=tv`): in turns mode the dice are the 3D view `/dice3d/index.html` in an iframe; if it does not load within 4 s or reports an error, it falls back to the 2D dice. The turn banner shows "Shaking…".

## Environment variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | project URL (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (server only; never in the client) |
| `SUPABASE_ANON_KEY` | `anon` key (clients receive it from `/api/config` for Realtime) |
| `PUBLIC_URL` | optional: public URL for the QR code (otherwise derived from the request host) |

For dev with Supabase: copy `.env.example` to `.env.local` and fill it in.

## Supabase

1. Create a project at [supabase.com](https://supabase.com) (region close to the players).
2. SQL Editor → paste and run `supabase/schema.sql` (creates `rooms`, `room_secrets`, RLS, the `add_player_token` function and adds `rooms` to the Realtime publication).
3. Project Settings → API: copy the URL, the `anon` key and the `service_role` key.
4. Optional, cleanup of expired rooms: Database → Extensions → enable `pg_cron` and run
   `select cron.schedule('generala-cleanup', '0 * * * *', $$select public.cleanup_expired_rooms()$$);`

## Deploy on Vercel

1. Import the repo in Vercel.
2. **Root Directory: `backend`**. Framework Preset: **Vite** (build `npm run build`, output `dist`). The functions in `api/` are detected automatically (Node runtime).
3. Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (and `PUBLIC_URL` if you use a custom domain).
4. Deploy. Check `https://YOUR-APP.vercel.app/api/config` → it must return `"realtime": true`.

`vercel.json` only adds the SPA route rewrite (`/tv`) without touching `/api`.

## Pointing the TV app at the server

In `tv/src/config.ts` set the API base URL: `https://YOUR-APP.vercel.app` (production) or `http://YOUR-MAC-IP:5173` (local dev on the same network). The TV creates the room with `POST /api/rooms` and shows the `joinUrl` returned by the server in the QR code.

## Narrator voice (OpenAI)

`GET /api/tts` generates the audio for each narrator line with OpenAI (`gpt-4o-mini-tts`). Set in Vercel → Settings → Environment Variables:

- `OPENAI_API_KEY` (required for the TV to speak; without it `/api/tts` answers 503 and the TV stays silent)
- Optional: `OPENAI_TTS_VOICE` (default `ash`), `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`)

It only accepts narrator lines (line type + name/score/category/round), not free text. Each distinct line is generated once and then served by Vercel's CDN.
