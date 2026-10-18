// Where the TV app finds the Generala API (backend/ — Vercel functions or the local Vite dev server).
//
// Local development on the Vega Virtual Device:
//   The VVD is a QEMU/Android-emulator VM with user-mode networking, so the host Mac is reachable
//   from inside the device at 10.0.2.2 (verified with curl from `vda shell`). The Mac's LAN IP also
//   works. Run the backend with `cd backend && npm run dev -- --port 5180`.
//   Start the backend with PUBLIC_URL=http://<LAN-IP-of-the-Mac>:5180 so the QR's joinUrl is
//   reachable from phones (otherwise it would point at 10.0.2.2, which only the VVD can reach).
//
// Deployed: the Vercel URL (no trailing slash). Switch API_BASE_URL back to LOCAL_API_BASE_URL for local dev.
export const LOCAL_API_BASE_URL = 'http://10.0.2.2:5180';
export const VERCEL_API_BASE_URL = 'https://generala.taplinko.store';

export const API_BASE_URL: string = VERCEL_API_BASE_URL;

// Live updates: the contract asks for a 1000 ms poll of GET /api/rooms/:code (realtime is optional).
export const POLL_MS = 1000;
export const REQUEST_TIMEOUT_MS = 8000;

// 3D dice (WebView). DICE3D_DEBUG_URL: when set (e.g. 'http://10.0.2.2:8766'), every message from the 3D view
// (ready / settled / error / stats) is also sent as GET <url>/dice3d?data=<json> — for testing on the VVD.
export const DICE3D_ENABLED = true;
export const DICE3D_DEBUG_URL = '';

// Narrator voice (native media player, src/ui/Voice.js). VOICE_DEBUG_URL works like DICE3D_DEBUG_URL and also
// makes the app say a fixed line at start (to check the speakers by ear).
export const VOICE_ENABLED = true;
export const VOICE_DEBUG_URL = '';
// Narrator audio: GET <VOICE_TTS_URL>?lang&k&name&score&cat&n (backend/api/tts.js, OpenAI). '' → no voice.
// Must be https: Vega blocks cleartext http.
export const VOICE_TTS_URL = API_BASE_URL + '/api/tts';
