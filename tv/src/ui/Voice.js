// Narrator voice: plays each new narrator line through Vega's native media player (W3C AudioPlayer from
// @amazon-devices/react-native-w3cmedia), fed with the MP3 from GET /api/tts (OpenAI). Audio played from a
// WebView never reached the speakers on Vega (it stalled or came out silent), so the voice is native.
//
// One line at a time, one player per line: re-pointing a single long-lived player at a new src while the previous
// stream was still closing left Vega's media/audio-focus IPC thread hung, and the system killed the app
// ("AppNotResponding"). So each line gets a fresh AudioPlayer that is fully deinitialized before the next one is
// created; a line that arrives meanwhile waits (only the newest waiting line is kept), and a watchdog drops a
// player that never reports 'ended'.
//
// Lines already on screen when the app (re)starts aren't spoken: only lines that appear after the first one this
// component saw. Renders nothing.
//
// `sfx` ({ id, url }) plays a sound effect through the same one-at-a-time player (the celebration jingle on the
// results screen); a pending sound goes before a pending line, so the jingle is heard before the closing narration.
import React from 'react';
import { AudioPlayer, AudioContentType, AudioUsageType } from '@amazon-devices/react-native-w3cmedia';
import { VOICE_DEBUG_URL, VOICE_TTS_URL } from '../config';

const WATCHDOG_MS = 20000; // narrator lines are ~3–7 s

// GET /api/tts?lang&k&v&name&score&cat&n — the server renders the line from the template (no free text).
function ttsUrl(l){
  const q = ['lang=' + l.lang, 'k=' + encodeURIComponent(l.k), 'v=' + (l.v || 0)];
  for (const key of ['name', 'score', 'cat', 'n']) { const val = l.vars && l.vars[key]; if (val !== undefined && val !== null && val !== '') q.push(key + '=' + encodeURIComponent(String(val))); }
  return VOICE_TTS_URL + '?' + q.join('&');
}

export class Voice extends React.Component {
  seen = undefined; seenSfx = undefined; pending = null; pendingSfx = null; busy = false; current = null; unmounted = false;

  componentDidMount(){
    this.check();
    // diagnostics: say a fixed line at start so the speaker path can be checked by ear
    if (VOICE_DEBUG_URL) { this.pending = { id: 'boot', k: 'newRound', vars: { n: 1 }, lang: this.props.lang || 'es' }; this.next(); }
  }
  componentDidUpdate(){ this.check(); }
  componentWillUnmount(){ this.unmounted = true; this.pending = null; if (this.current) this.current.finish('unmount'); }

  debug(o){ if (VOICE_DEBUG_URL) fetch(VOICE_DEBUG_URL + '/voice?data=' + encodeURIComponent(JSON.stringify(o))).catch(() => {}); }

  check(){
    const { line, sfx, enabled } = this.props;
    const sid = sfx && sfx.url ? sfx.id : null;
    if (this.seenSfx === undefined) this.seenSfx = sid; // baseline: a results screen we resumed on stays quiet
    else if (sid !== this.seenSfx) { this.seenSfx = sid; if (sid && enabled) { this.pendingSfx = sfx; this.next(); } }
    const id = line ? line.id : null;
    if (this.seen === undefined) { this.seen = id; return; } // baseline: don't replay the line we resumed on
    if (id === this.seen) return;
    this.seen = id;
    if (!line) return;
    if (!enabled) { this.stop(); return; }
    this.pending = line; // a newer line replaces one that was still waiting
    this.next();
  }

  stop(){ this.pending = null; this.pendingSfx = null; if (this.current) this.current.finish('stopped'); }

  async next(){
    if (this.busy || this.unmounted) return;
    const item = this.pendingSfx || (VOICE_TTS_URL ? this.pending : null);
    if (!item) return;
    if (item === this.pendingSfx) this.pendingSfx = null; else this.pending = null;
    this.busy = true;
    try { await this.play(item); }
    catch (e) { this.debug({ type: 'playFailed', id: item.id, err: String(e && (e.message || e)) }); }
    this.busy = false;
    this.next();
  }

  // Resolves once the line (or sound effect: an item with its own `url`) has finished, failed or was stopped, and
  // its player is deinitialized.
  play(line){
    return new Promise(resolve => {
      const p = new AudioPlayer(line.url ? AudioContentType.CONTENT_TYPE_MUSIC : AudioContentType.CONTENT_TYPE_SPEECH, AudioUsageType.USAGE_MEDIA);
      let done = false, timer = null;
      const finish = (why) => {
        if (done) return; done = true; clearTimeout(timer);
        if (this.current && this.current.p === p) this.current = null;
        this.debug({ type: 'finish', id: line.id, why });
        if (why !== 'ended' && why !== 'initError') { try { p.pause(); } catch (e) {} }
        p.deinitialize().catch(e => this.debug({ type: 'deinitError', id: line.id, err: String(e && (e.message || e)) })).then(() => resolve());
      };
      this.current = { p, finish };
      p.addEventListener('ended', () => finish('ended'));
      p.addEventListener('error', () => finish('error ' + (p.error ? p.error.code + ' ' + p.error.message : '')));
      if (VOICE_DEBUG_URL) for (const ev of ['playing', 'waiting', 'pause']) p.addEventListener(ev, () => this.debug({ type: ev, id: line.id, t: p.currentTime }));
      timer = setTimeout(() => finish('watchdog'), WATCHDOG_MS);
      p.initialize().then(() => {
        if (done) return;
        p.src = line.url || ttsUrl(line);
        const r = p.play(); if (r && r.catch) r.catch(e => finish('playError ' + String(e && (e.message || e))));
        this.debug({ type: 'say', id: line.id });
      }, e => { this.debug({ type: 'initError', id: line.id, err: String(e && (e.message || e)) }); finish('initError'); });
    });
  }

  render(){ return null; }
}
