// "It's your turn" alert on the phone: a vibration pattern (Android; iOS Safari has no Vibration API) plus a
// short two-note chime made with Web Audio (works on iOS too). Browsers only let a page make sound after a user
// gesture, so the AudioContext is created/resumed on the first touch (joining the room always involves one).
let ctx = null;

function unlock(){
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); // iOS: play silence once
  } catch (e) { /* no audio */ }
}
export function armTurnAlert(){
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
}

function chime(){
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  [[880, 0], [1318.5, 0.16]].forEach(([f, at]) => {                // A5 → E6, a bright "ding-ding"
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(0.35, t + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.45);
    o.connect(g); g.connect(ctx.destination);
    o.start(t + at); o.stop(t + at + 0.5);
  });
}

export function turnAlert(){
  try { navigator.vibrate && navigator.vibrate([180, 90, 180, 90, 260]); } catch (e) {}
  try { chime(); } catch (e) {}
}
