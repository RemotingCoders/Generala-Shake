// "It's your turn" alert on the phone: a vibration pattern (Android; iOS Safari has no Vibration API) plus a
// short two-note chime made with Web Audio (works on iOS too).
//
// What makes it actually fire on real phones:
// - Browsers only allow sound/vibration after the user touched the page (Chrome: "sticky activation", lost on a
//   reload/auto-rejoin; iOS: the AudioContext must be resumed inside a touch). So every touch re-unlocks, and
//   `needsTap()` tells the UI to ask for one when the page hasn't been touched since it loaded.
// - iOS Safari plays Web Audio in the "ambient" session by default, which the ring/silent switch mutes:
//   navigator.audioSession.type = 'playback' (Safari 16.4+) makes the chime audible in silent mode.
// - A locked/sleeping phone runs no JS at all, so during a game the screen is kept on with the Screen Wake Lock
//   API (re-requested whenever the page becomes visible again).
let ctx = null, wakeLock = null, wantAwake = false, touched = false;

function unlock(){
  touched = true;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); // iOS: play silence once
  } catch (e) { /* no audio */ }
  if (wantAwake && !wakeLock) requestWake();
}

async function requestWake(){
  if (!wantAwake || wakeLock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
  catch (e) { wakeLock = null; } // e.g. iOS before a touch, battery saver
}

export function armTurnAlert(){
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestWake(); });
}

// Keep the screen on while a game is in progress (the alert can't fire on a locked phone).
export function keepAwake(on){
  wantAwake = !!on;
  if (on) requestWake();
  else if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

// True when the page hasn't been touched since it loaded, so sound/vibration would be blocked.
export function needsTap(){
  if (touched) return false;
  const ua = navigator.userActivation;
  return !(ua && ua.hasBeenActive);
}

function chime(){
  if (!ctx) return;
  const ring = () => {
    const t = ctx.currentTime;
    [[880, 0], [1318.5, 0.16], [1760, 0.32]].forEach(([f, at]) => {          // A5 → E6 → A6, a bright "ding-ding-ding"
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.5, t + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.5);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + at); o.stop(t + at + 0.55);
    });
  };
  if (ctx.state === 'running') ring(); else ctx.resume().then(ring, () => {}); // may work if not interrupted
}

export function turnAlert(){
  try { navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 300]); } catch (e) {}
  try { chime(); } catch (e) {}
}
