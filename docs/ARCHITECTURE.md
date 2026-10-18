# Generala — architecture and API contract

Source of truth for the backend (`backend/`) and the Fire TV app (`tv/`). If you need to change the contract, change this file too.

## Layout

```
shared/     engine.js (rules, pure functions) and i18n.js (es/en strings). Edit ONLY here.
            `node scripts/sync-shared.mjs` copies them into backend/shared/ and tv/src/shared/.
backend/    Vercel project: serverless API in api/, phone web controller (Vite + React),
            supabase/schema.sql. Deployed with Vercel, root directory = backend/.
tv/         Vega (React Native for Fire TV) app: the host screen. Runs on the Vega Virtual Device.
```

## Roles

- **TV (host)**: creates the room, shows the QR + code, starts/pauses/ends the game, renders dice, sheet, narrator, results. Holds a `hostToken`.
- **Phone (player)**: opens the join URL from the QR (`{publicUrl}/?room=CODE`), picks a nickname and color, then rolls, holds and scores. Holds a `playerToken` (saved in localStorage per room so reload = rejoin).
- **Server**: the only writer. Rolls the dice (crypto RNG), validates every action with `shared/engine.js`, stores state in Supabase.

## Public room state

`state` = the engine game object (see `newGame` in engine.js) plus:

- `players[].lastSeen` (ms epoch, updated by `ping`). A player counts as connected when `now - lastSeen < 35000`. `players[].connected` is kept in sync by the server on ping/leave.
- `events`: last 10 narrator-worthy events `{ id, ts, type, pid?, cat?, score?, round?, winnerIds?, tie?, variant }` (types from engine: `score`, `yahtzeeBonus`, `servidaWin`, `newRound`, `lead`, `end`). `id` is a monotonically increasing integer.
- `expiresAt` (ms epoch). Rooms live 4 hours.
- `seq` (engine already has it): increments on every write. Clients drop any state whose `seq` is lower than the one they have.

Tokens are NEVER part of `state`.

## HTTP API

All bodies are JSON. Errors are `{ "error": "<code>" }` with a 4xx status. CORS: `Access-Control-Allow-Origin: *` on every `/api/*` response, and `OPTIONS` preflight returns 204.

| Method & path | Body | Success | Error codes |
|---|---|---|---|
| `GET /api/config` | — | `{ supabaseUrl, supabaseAnonKey, publicUrl, realtime: bool }` | — |
| `POST /api/rooms` | `{ variant: 'generala'\|'yahtzee', mode: 'turns'\|'simul', narrator: bool, demoLength: 'short'\|'full' }` | 201 `{ code, hostToken, joinUrl, state }` | `badRequest` |
| `GET /api/rooms/:code` | — | `{ state }` | 404 `notfound`, 410 `expired` |
| `POST /api/rooms/:code/join` | `{ name, color, playerToken? }` | `{ playerId, playerToken, state }` (same playerId on rejoin with a valid token) | `notfound`, `expired`, `closed`, `started`, `full`, `badRequest` |
| `POST /api/rooms/:code/host` | `{ hostToken, action }` where action ∈ `start`, `pause`, `resume`, `end`, `rematch`, `close`. `rematch` may also carry `variant`, `mode`, `narrator`, `demoLength` to change the rules and keep the players ("Change variant"). | `{ state }` | `unauthorized`, `notfound`, `expired`, `closed`, `notEnough`, `notPlaying`, `badRequest` |
| `POST /api/rooms/:code/play` | `{ playerToken, action, index?, cat? }` where action ∈ `roll`, `hold` (index 0–4), `choose` (cat), `ping`, `leave` | `{ state }` | `unauthorized`, `notfound`, `expired`, plus engine errors: `notPlaying`, `notYourTurn`, `alreadyDone`, `noRolls`, `rollFirst`, `categoryUnavailable` |

HTTP status per error code: `badRequest` 400, `unauthorized` 401, `notfound` 404, `expired` 410, everything else 409 (`closed`, `started`, `full`, `notEnough`, engine errors, and `busy` when 5 optimistic-concurrency retries all conflict). Unexpected failures: 500 `{ "error": "server" }`.
Actions on a closed room return `closed` (except `ping`/`leave`, which are no-ops). `start` outside the lobby and `rematch` during play are `badRequest`; `pause`/`resume`/`end` outside play are `notPlaying`; `pause` when already paused (and `resume`/`close` likewise) is a no-op.
`leave` in the lobby removes the player (frees the seat); during a game it only marks them disconnected (`lastSeen = 0`).

Color on join: if the requested color is taken, the server assigns the first free one from `COLORS`.
Room codes: 4 letters from `ABCDEFGHJKMNPQRSTUVWXYZ`, unique among live rooms.

Room lifetime: `expiresAt = createdAt + 4 h`, renewed to `now + 4 h` on every `rematch`.

Extra state fields written by the server: `lastEventId` (the id counter, so ids keep growing after a rematch clears `events`). Events also carry the engine's extra fields (`served`, `five`, `joker` on `score`). `rematch` keeps `seq` growing (never resets to 0).

## Live updates

1. Clients call `GET /api/config` once.
2. If `realtime` is true, subscribe with supabase-js to `postgres_changes` (`event: 'UPDATE'`, `schema: 'public'`, `table: 'rooms'`, `filter: 'code=eq.CODE'`); `payload.new.state` is the new state.
3. Always also poll `GET /api/rooms/:code`: every 1000 ms when realtime is off or not yet subscribed, every 5000 ms as a safety net when realtime is on.
4. Players send `ping` every 10 s while the page is visible.

## Supabase

- `public.rooms (code text primary key, state jsonb not null, seq int not null, created_at timestamptz default now(), updated_at timestamptz default now(), expires_at timestamptz not null)`. RLS on; policy: `anon` and `authenticated` may `select`. No insert/update/delete policies (only the service role writes). Added to the `supabase_realtime` publication.
- `public.room_secrets (code text primary key references rooms on delete cascade, host_token text not null, player_tokens jsonb not null default '{}')` — RLS on, no policies (service role only). `player_tokens` maps token → playerId.
- `public.add_player_token(p_code, p_token, p_player_id)` (security definer, service role only): atomic `player_tokens || {token: id}` merge so simultaneous joins can't overwrite each other's token.
- `public.cleanup_expired_rooms()` (optional): deletes rooms expired for more than a day; can be scheduled with pg_cron.
- Writes use optimistic concurrency: `update rooms set state=$new, seq=$new.seq ... where code=$code and seq=$old.seq`; on 0 rows, re-read and retry (max 5).

## Backend env vars

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, optional `PUBLIC_URL` (else derived from the request host). If the Supabase vars are missing the backend uses an in-memory store (local development only) and `/api/config` returns `realtime: false`.

## Local development

`cd backend && npm run dev` serves the phone web app AND `/api/*` on `0.0.0.0:5173` (`npm run dev -- --port 5180` for another port; `strictPort` is on), so a phone on the same Wi-Fi and the Vega Virtual Device can reach it. The TV app reads its API base URL from `tv/src/config.ts`.
In dev, when the request host is `localhost`/`127.0.0.1`, `publicUrl`/`joinUrl` use the machine's LAN IPv4 instead, so the QR works from a phone. `.env.local` in `backend/` is loaded into `process.env` for the API.

Backend layout: `backend/api/**` are thin Vercel handlers (`api/config.js`, `api/rooms/index.js`, `api/rooms/[code]/index.js`, `api/rooms/[code]/{join,host,play}.js`); logic lives in `backend/lib/` (`rooms.js` service, `store.js` Supabase + in-memory adapters, `http.js` CORS/JSON/errors, `router.js` used by the Vite dev plugin and the tests). Web host for debugging: `/?surface=tv` (or `/tv`).

## Rules note

Generala: Doble generala stays locked while the Generala box is empty; once Generala is filled with anything other than 50 (scratched), Doble generala can only be scratched (0). Without this a player could be left with no legal box in the last round.
