# Generala — TV app (Vega OS / Fire TV)

Host app for Fire TV built with **React Native for Vega** (RN 0.83, `@amazon-devices/react-native-kepler` 4.x).
The TV creates the room, shows the QR code and the room code, the dice, the score sheet, the narrator and the
results; players join and play from their phone's browser. The server (`backend/`) is the single source of truth.

## Requirements

- macOS with Vega SDK 0.24 and the Vega CLI (`~/vega/bin/vega`, tested with 1.4.4).
- Node 20+ (tested with 24) and npm.
- Vega Virtual Device (VVD) installed with the SDK.
- The backend running (locally or on Vercel), see `backend/` and `docs/ARCHITECTURE.md`.

## Install dependencies

```bash
cd tv
npm install
```

`src/shared/engine.js` and `i18n.js` are generated from `shared/`: `node scripts/sync-shared.mjs` (from the repo root).

## Build

```bash
cd tv
scripts/build.sh Debug      # or Release
```

The package ends up in `build/aarch64-debug/generala_aarch64.vpkg` (VVD on Apple Silicon Macs); `armv7` (physical
Fire TV devices) and `x86_64` are built as well.

> The Vega toolchain fails when the project path contains spaces (`kepler-module-manifest-builder` runs an
> unquoted command). `scripts/build.sh` detects this, mirrors `tv/` into `/tmp/generala-tv-build` (override with
> `VEGA_BUILD_DIR`), builds there and copies `build/` back. Without spaces in the path it is equivalent to
> `npx react-native build-vega --build-type Debug`.

## Virtual device

```bash
vega virtual-device start      # opens the emulator (about 1 min the first time)
vega virtual-device status
vega device list               # should list "VirtualDevice : tv - aarch64"
```

## Install and launch

```bash
vega run-app build/aarch64-debug/generala_aarch64.vpkg com.generalashake.tv.main
# or step by step:
vega device install-app ... / vega device launch-app --appName com.generalashake.tv.main
vega device terminate-app --appName com.generalashake.tv.main
```

Reinstalling wipes the app data (the saved room); closing and reopening the app keeps it.

## Server (API_BASE_URL)

Configured in `src/config.ts`:

```ts
export const API_BASE_URL: string = LOCAL_API_BASE_URL;   // 'http://10.0.2.2:5180'
// export const API_BASE_URL: string = VERCEL_API_BASE_URL; // 'https://<your-project>.vercel.app'
```

- **Local**: the VVD is a QEMU VM with user networking; from inside it, the Mac is **`10.0.2.2`** (the Mac's LAN IP
  works too). Start the backend with
  `cd backend && npm run dev -- --port 5180`.
  The server builds the QR `joinUrl` from the request host; since the TV calls `10.0.2.2`, start the backend with
  `PUBLIC_URL=http://<your-Mac-LAN-IP>:5180` so the QR code works from a phone.
- **Vercel**: set `API_BASE_URL` to the deployed URL (no trailing `/`) and rebuild.

Live updates: polling `GET /api/rooms/:code` every 1000 ms (states with a lower `seq` are ignored).
The TV does not use Supabase Realtime.

## 3D dice

In turns mode the tray shows 3D dice (Three.js r170) inside a WebView
(`@amazon-devices/webview` 4.0.2; `manifest.toml` declares the webview module and the
`com.amazon.webview.renderer_service` service).

- The page is `assets/dice3d/` (`index.html`, `motion-engine.js`, `three.classic.js`): these are **generated copies**
  of `shared/dice3d/` made with `node scripts/sync-shared.mjs` (from the repo root). Do not edit them here.
- `src/ui/Dice3D.js` feeds it with `window.diceUpdate({dice, held, rolled, rollId, shaking, color, reduced})`
  (protocol in `docs/ARCHITECTURE.md`, "3D dice view"). While the player shakes the phone the dice spin and the
  status reads "Shaking…"; on a new roll they brake within 5 s onto the server's values. Held dice do not spin:
  they stay raised with a frame in the player's color. The score sheet shows the possible scores only once the
  dice have landed.
- If the WebView does not load (or does not answer within 12 s) the usual 2D dice are used. Simultaneous mode
  always uses 2D.
- The WebView never takes remote-control focus (the buttons above it have `nextFocusDown` pointing at themselves).
- Debugging: in `src/config.ts`, `DICE3D_DEBUG_URL = 'http://10.0.2.2:8766'` sends every WebView message
  (`ready`, `settled` with the faces read from the scene, `stats` with fps) to an HTTP receiver on the Mac.
  `DICE3D_ENABLED = false` falls back to the 2D dice.

## Remote control (D-pad)

| Key | Action |
|---|---|
| Arrows | Move focus (Vega's native spatial navigation; focus is shown with a yellow ring) |
| OK / Select | Choose |
| Back | Help → close · Settings → home · Lobby → close room · Game → pause/resume · Results / closed room → home · Home → exit the app |

In the emulator: keyboard arrows and Enter; Esc = Back. To automate:
`vda shell 'inputd-cli button_press KEY_RIGHT'` (`KEY_ENTER`, `KEY_BACK`, ...).

## Layout

- `src/App.js` — state, host flow, polling, Back key, persistence of `{code, hostToken, joinUrl}`.
- `src/screens.js` — screens (home, settings, lobby, turns / simultaneous game, pause, results, closed room, help).
- `src/viewModel.js` — screen data derived from the server state (it does not compute results).
- `src/ui/` — 1280×720 → real screen scaling, focusable buttons, dice, QR (`qrcode-generator`), narrator.
- `src/api.js`, `src/storage.js`, `src/config.ts`.
- `assets/fonts/` — Fredoka and Nunito (OFL). Vega registers each font by file name (`Nunito-Bold`, ...).
- `test/` — `npm test` (Jest).

## Narrator voice

The narrator lines play through the TV speakers: `src/ui/Voice.js` plays the MP3 from `GET <API>/api/tts` (OpenAI, see `backend/README.md`) with Vega's native player (`AudioPlayer` from `@amazon-devices/react-native-w3cmedia`). It honors "Mute" and the narrator being off. Requires `OPENAI_API_KEY` on Vercel; without it the TV stays silent with no visible error.

Audio from a WebView does not work on Vega (no `speechSynthesis` voices, `<audio>` stalls, Web Audio has no output), which is why the voice is native. With `VOICE_DEBUG_URL` in `src/config.ts` the app says a fixed line at startup, handy for testing the speakers. In the emulator, sound comes out of whatever audio output the Mac had when the emulator started: if you change it, restart the emulator.
