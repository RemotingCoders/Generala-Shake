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
| `POST /api/rooms/:code/play` | `{ playerToken, action, index?, cat?, active? }` where action ∈ `roll`, `shake` (active: bool), `hold` (index 0–4), `choose` (cat), `ping`, `leave` | `{ state }` | `unauthorized`, `notfound`, `expired`, plus engine errors: `notPlaying`, `notYourTurn`, `alreadyDone`, `noRolls`, `rollFirst`, `categoryUnavailable` |

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

## Live shaking and 3D dice

Based on the tested Three.js prototype (spin while shaking, then a 5 s continuous brake that lands on the result face, shown front-on to an orthographic camera). Source copied to `shared/dice3d/`.

### Shaking state (server)

- Hand fields: `hand.shaking` (bool) and `hand.shakeTs` (ms epoch of the last change). In simultaneous mode the same fields live in `hands[pid]`. Fresh hands start with `shaking: false`.
- `POST /api/rooms/:code/play` action `shake` with `{ active: true|false }`. Same checks as `roll` (`notPlaying`, `notYourTurn`, `alreadyDone`, `noRolls`). Engine: `setShaking(state, pid, active, now)` in `shared/engine.js`. Does NOT add an event.
- `roll` always clears `shaking`. Viewers treat `shaking` as false once `now - shakeTs > 8000` (a phone that died mid-shake).
- `shared/engine.js` exports `DICE_SETTLE_MS = 5000` (brake duration) and `MIN_SPIN_MS = 350` (minimum spin before braking when a roll arrives without a prior shake).

### Phone

- Shake detection uses `ShakeDetector` from `shared/dice3d/motion-engine.js` (two strong peaks within 180 ms start a shake, 550 ms of calm ends it; threshold 7 m/s²).
- Shake start → `shake {active:true}`; shake end → `roll`. The Roll button: press-and-hold = shake (sends `shake` on press), release = `roll`; a quick tap = `roll`.
- After a new `rollId` the phone keeps the dice hidden/tumbling for `DICE_SETTLE_MS` so the reveal matches the TV, then shows the values and enables hold/score. Held dice stay visible.
- Implementation notes (backend/src/PhoneApp.jsx): the button starts the shake only after 150 ms of press, so a quick tap sends just `roll`; `pointercancel`, leaving the Dice tab or hiding the page sends `shake {active:false}`. `shake`/`roll` requests are sent in order (a promise chain). A shake held longer than 4 s re-sends `shake {active:true}` so viewers don't drop it as stale. The hidden time is `DICE_SETTLE_MS`, plus `MIN_SPIN_MS` when the roll had no shake of at least `MIN_SPIN_MS` before it; it is measured from the moment the phone receives the new roll (local clock), is skipped on the first state after a load/reload or when the page is hidden, and ends at the latest when the page becomes visible again past its deadline. Roll/shake/hold/score are disabled while landing. `ShakeDetector` is imported from `backend/shared/motion-engine.js`, an ES-module wrapper generated by the sync script.
- A roll is identified by `round | activeIdx (turns) or playerId (simul) | rollId`, because `hand.rollId` restarts at 0 with every fresh hand.

### 3D dice view (`shared/dice3d/index.html`, embedded by the TV app in a WebView and by the web TV in an iframe)

- Self-contained page: `index.html` + `motion-engine.js` + `three.classic.js` (Three r170), no CDN, transparent or table-colored background, cream dice (#FFF9EE→#EAD9BE look) with dark pips (#2A211C), held dice lifted with a ring in the player color.
- Input: the host calls `window.diceUpdate(msg)` (WebView `injectJavaScript`, iframe `contentWindow.diceUpdate`) and the page also accepts `window.postMessage(msg)`:
  `{ type: 'dice', dice: [5 ints], held: [5 bools], rolled: bool, rollId: int, shaking: bool, color: '#hex', reduced: bool }`.
- Behavior: `shaking` → non-held dice spin. A new `rollId` → non-held dice brake (after at least `MIN_SPIN_MS` of spin) onto `dice` over `DICE_SETTLE_MS`. Held dice never spin. Same `rollId` again → no animation. First message / reload → show `dice` at rest without animation. `reduced` → no spin, snap to faces.
- Output (to `window.ReactNativeWebView.postMessage` if present, else `parent.postMessage`): `{ type: 'ready' }`, `{ type: 'settled', rollId, faces }`, `{ type: 'error', message }`.
  `settled` is sent whenever the dice come to rest (after a brake, the first render, a reduced-motion snap, or a fresh-hand snap); `faces` are read back from the dice's world matrices (the face whose normal points at the camera) and it also carries `valid: bool` (exactly one face front-on per die and faces equal the requested `dice`). `ready` may arrive twice (also on `load`, in case the native bridge attaches late); hosts just re-send the current message.
- Page details: query params `bg=<hex without #>|transparent` (default transparent), `pr=<pixel ratio>` (default 1), `debug=1` (also emits `{ type: 'stats', fps, maxGapMs, phase }` every 5 s while rendering). Renders only while something moves. Orthographic camera fitted to the page size on resize (no reload); 5 dice in a row, spaced so spinning dice never overlap. `DiceMotion` (motion-engine.js) takes a mask: `setActive(true, now, mask)` spins only the non-held dice, `setFrontFaces`, `snapDie`, `snap`; without a mask it behaves like the prototype.
- Hosts must send a `rollId` that only grows within a page's life: the engine's `hand.rollId` restarts with every fresh hand (1, 2, 3 for each turn), so the web TV (`backend/src/Dice3D.jsx`) maps the key `round|activeIdx|hand.rollId` to its own counter, incremented whenever the key changes while `rolled` is true.
- Web TV (`/?surface=tv`, turn-based tray): `<iframe src="/dice3d/index.html">`, messages sent on every change and again on `ready`; falls back to the 2D dice on `error` or when `ready` doesn't arrive within 4 s. While the 3D dice land it hides the active player's potential scores ("…") and the first-roll badge. The banner shows "Agitando…/Shaking…" while `E.isShaking(hand, now)`; simultaneous-mode panels show it as the player's status.
- Copies: `node scripts/sync-shared.mjs` writes `index.html`, `motion-engine.js` and `three.classic.js` (not `prototype.html`) to `backend/public/dice3d/` (served at `/dice3d/`) and `tv/assets/dice3d/`. `index.html` and `three.classic.js` are byte-identical copies; `motion-engine.js` gets the one-line GENERATED header.
- Fire TV (`tv/src/ui/Dice3D.js`, turn-based tray only): `@amazon-devices/webview` with `file:///pkg/assets/dice3d/index.html?bg=24201B`, fed with `injectJavaScript('window.diceUpdate(...)')` on change and on `ready`; same rollId mapping (key `round:activeIdx:hand.rollId`). Shows the 2D dice while loading and for good on `error`, load error or no `ready` within 12 s (the WebView stays mounted: unmounting it from its error callback crashed the app on the VVD). Shake staleness is measured from when the TV first saw that `shakeTs` (immune to clock skew). Potentials and the first-roll badge wait for `settled` (or `DICE_SETTLE_MS` + 1.5 s). The WebView is a native focus target even with `focusable={false}`, so the bar buttons above it set `nextFocusDown` to themselves. Simultaneous mode keeps the 2D dice.

### Phone 3D dice

The phone shows the same `dice3d/index.html` (iframe, `?layout=grid&pr=<devicePixelRatio, max 2>`: 3 dice over 2 for portrait) instead of the 2D dice, which remain only as the fallback. It spins with visible pips while the player shakes or holds the Roll button (and until the server's roll arrives), then lands on the server's dice. Extra output message `{ type:'tap', index }` (pointer on a die) toggles hold. A `settled` message within the last 1.5 s of the settle window reveals the sheet a little early; earlier ones (a reloaded view snapping) are ignored.
