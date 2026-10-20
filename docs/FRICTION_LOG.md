# Friction Log — Generala Shake

Amazon Developer Hackathon 2026 ("Build, Ship, Shape"), Fire TV track.
Stack: React Native for Vega (Vega SDK 0.24, RN 0.83), Vega Virtual Device on macOS / Apple Silicon, Amazon Devices Builder Tools MCP.

Each entry follows the requested format: task attempted, steps taken, expected vs. actual result, severity, workaround used, actionable suggestion. Every item comes from something that happened in this repository (see the files referenced).

---

## 1. Build fails when the project path contains spaces

- **Task:** Build the app with `npx react-native build-vega --build-type Debug`.
- **Steps:** The project lives under a folder with a space in its name (`Generala Shake`). Ran the standard build command.
- **Expected:** A `.vpkg` in `build/`.
- **Actual:** The toolchain (`kepler-module-manifest-builder`) runs a shell command through an unquoted `execSync` and breaks on the space. The error does not mention the path at all.
- **Severity:** High (blocks the build; the cause is not discoverable from the error).
- **Workaround:** A wrapper script, [`tv/scripts/build.sh`](../tv/scripts/build.sh), rsyncs `tv/` into `/tmp/generala-tv-build`, builds there and copies `build/` back.
- **Suggestion:** Quote paths in the manifest builder, or fail fast with "project path must not contain spaces". Mention the limitation in "Build a New App from a Template".

## 2. Audio from a WebView never reaches the speakers

- **Task:** Play the narrator voice from the same WebView that renders the 3D dice (`speechSynthesis` first, then `<audio>`, then Web Audio).
- **Steps:** Tried `window.speechSynthesis` (no voices listed), an `<audio>` element with an MP3 (stalls, never fires `ended`), and an `AudioContext` oscillator (no output).
- **Expected:** At least one of the three standard web audio paths to work, since the WebView otherwise behaves like Chromium.
- **Actual:** Silence in all three cases, with no error in the console or in the device logs.
- **Severity:** High (two days of debugging; forced a native rewrite of the voice feature).
- **Workaround:** Moved the voice to the native player (`AudioPlayer` from `@amazon-devices/react-native-w3cmedia`) fed with MP3s from our backend. See [`tv/src/ui/Voice.js`](../tv/src/ui/Voice.js).
- **Suggestion:** Document which Web APIs are unavailable in the Vega WebView (`speechSynthesis`, audio output) in "Overview of Vega Web Apps", and log a warning when a page calls them.

## 3. Reusing one AudioPlayer across clips hangs the media IPC thread and the OS kills the app

- **Task:** Speak consecutive narrator lines with a single long-lived `AudioPlayer`, changing `src` each time.
- **Steps:** Set a new `src` while the previous stream was still closing.
- **Expected:** The player to switch sources, as an HTML `<audio>` element would.
- **Actual:** The media / audio-focus IPC thread hangs and the system terminates the app with `AppNotResponding`. No JS-side error before the kill.
- **Severity:** High (random crashes in a demo-critical feature).
- **Workaround:** One fresh `AudioPlayer` per line, fully deinitialized before the next one is created, plus a watchdog that drops a player that never reports `ended`.
- **Suggestion:** Make `src` changes safe on a live player, or state in the w3cmedia guide that a player must be deinitialized before reuse and that the failure mode is an ANR kill rather than an error.

## 4. Vega Virtual Device has no sound when the Mac's default output is a multichannel interface

- **Task:** Hear the narrator in the emulator.
- **Steps:** The Mac's default output was a Behringer UMC1820 (20 channels, 48 kHz). Started the VVD and launched the app.
- **Expected:** Audio through the default output, or an error visible in the CLI.
- **Actual:** Silence. The only clue is `coreaudio: Could not initialize playback` / `Failed to create voice goldfish_audio` buried in `~/vega/sdk/vega-sdk/main/<ver>/vvd/instances/<id>/virtual_device.err`. The emulator also binds to whatever output was the default when it started; changing it later has no effect.
- **Severity:** Medium (cost about half a day; it looked like an app bug).
- **Workaround:** Select a plain stereo device (MacBook speakers) in System Settings > Sound, then `vega virtual-device stop` and `start`.
- **Suggestion:** Surface audio backend failures in `vega virtual-device status`, and add a CLI flag or setting to pick the audio output device.

## 5. Reaching a local backend from the VVD and getting a working QR code

- **Task:** Point the TV app at a backend running on the Mac and have a phone join by scanning the QR code.
- **Steps:** Used the Mac's LAN IP first; then discovered the VVD is a QEMU VM with user networking where the host is `10.0.2.2`.
- **Expected:** Documentation on how the virtual device sees the host machine.
- **Actual:** Not in the Vega docs (found by knowing QEMU). A second problem followed: our backend builds the join URL from the request host, so the QR encoded `10.0.2.2`, which a phone cannot reach.
- **Severity:** Low (one-time setup, but every new developer hits it).
- **Workaround:** Added a `PUBLIC_URL` env var to the backend so the QR carries the LAN IP while the TV talks to `10.0.2.2`.
- **Suggestion:** Add a "Networking from the Vega Virtual Device" section to "Run Your App on Vega Virtual Device" with the `10.0.2.2` host alias and port-forwarding notes.

## 6. WebView `ready` handshake arrives late or twice

- **Task:** Drive the 3D dice page with `injectJavaScript` after it posts a `ready` message.
- **Steps:** The page posts `ready` on load; the native bridge (`postMessage`) was sometimes not attached yet on first load, so the message was lost or a second `ready` came later.
- **Expected:** The bridge to be available before the page's load event, as on other React Native WebViews.
- **Actual:** Intermittent. We had to make the handshake idempotent and add a 12 s timeout that falls back to 2D dice. See [`tv/src/ui/Dice3D.js`](../tv/src/ui/Dice3D.js).
- **Severity:** Low.
- **Workaround:** Idempotent `ready` handling (same `rollId` = no-op) plus a readiness timeout with a 2D fallback.
- **Suggestion:** Guarantee the bridge is injected before `DOMContentLoaded`, or document the ordering.

## 7. Reinstalling the app wipes its storage on the device

- **Task:** Iterate on the app while keeping the saved room (host token) between installs.
- **Steps:** `vega run-app` / `vega device install-app` after each build.
- **Expected:** App data to survive an upgrade install, as on Android.
- **Actual:** AsyncStorage is cleared on every reinstall; only close/reopen keeps it.
- **Severity:** Low (slows the dev loop for features that depend on persisted state).
- **Workaround:** Re-create the room after each install.
- **Suggestion:** A `--keep-data` option on install, or a note in "Run Your App" stating that reinstall clears app data.

## 8. Amazon Devices Builder Tools MCP: tool calls fail until `set_project_context` is called

- **Task:** Search the Vega docs through the MCP server from an AI coding assistant.
- **Steps:** Called `search_documentation` directly.
- **Expected:** A result, or an automatic context setup from `tv/.adbt-config.json`.
- **Actual:** `PROJECT_CONTEXT_REQUIRED` on every tool until `set_project_context` is called by hand. The KPI Visualizer also writes `tv/output` and `tv/generated` into the project, which had to be gitignored.
- **Severity:** Low.
- **Workaround:** Call `set_project_context` with the parsed `.adbt-config.json` first; add the output folders to `.gitignore`.
- **Suggestion:** Read `.adbt-config.json` automatically on the first tool call, and write KPI output outside the source tree (or create a `.gitignore` entry).

---

## What worked well

- Cold-start KPIs on the Vega Virtual Device (TTFF ~630 ms, TTFD ~650 ms) were easy to measure once `useReportFullyDrawn` was wired ([`tv/src/ui/FullyDrawn.js`](../tv/src/ui/FullyDrawn.js)).
- Native spatial focus with the D-pad needed almost no code.
- The Builder Tools review of the manifest and best practices produced concrete fixes (ErrorBoundary, accessibility labels, overdraw reduction) in one pass.
