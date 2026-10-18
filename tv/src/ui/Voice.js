// Narrator voice: plays each new narrator line through Vega's native media player (W3C AudioPlayer from
// @amazon-devices/react-native-w3cmedia), fed with the MP3 from GET /api/tts (OpenAI). Audio played from a
// WebView never reached the speakers on Vega (it stalled or came out silent), so the voice is native.
// Lines already on screen when the app (re)starts aren't spoken: only lines that appear after the first one this
// component saw. Renders nothing.
import React from 'react';
import { AudioPlayer, AudioContentType, AudioUsageType } from '@amazon-devices/react-native-w3cmedia';
import { VOICE_DEBUG_URL, VOICE_TTS_URL } from '../config';

// GET /api/tts?lang&k&name&score&cat&n — the server renders the line from the template (no free text).
function ttsUrl(l){
  const q = ['lang=' + l.lang, 'k=' + encodeURIComponent(l.k)];
  for (const key of ['name', 'score', 'cat', 'n']) { const val = l.vars && l.vars[key]; if (val !== undefined && val !== null && val !== '') q.push(key + '=' + encodeURIComponent(String(val))); }
  return VOICE_TTS_URL + '?' + q.join('&');
}

export class Voice extends React.Component {
  seen = undefined; pending = null; player = null; ready = false; speaking = null;

  componentDidMount(){
    this.check();
    const p = new AudioPlayer(AudioContentType.CONTENT_TYPE_SPEECH, AudioUsageType.USAGE_MEDIA);
    for (const ev of ['playing', 'ended', 'error', 'pause', 'waiting']) p.addEventListener(ev, () => this.onEvent(ev));
    p.initialize().then(() => {
      this.player = p; this.ready = true; this.debug({ type: 'ready' });
      // diagnostics: say a fixed line at start so the speaker path can be checked by ear
      if (VOICE_DEBUG_URL && !this.pending) this.pending = { id: 'boot', k: 'newRound', vars: { n: 1 }, lang: this.props.lang || 'es' };
      this.flush();
    }, e => this.debug({ type: 'initError', err: String(e && (e.message || e)) }));
  }
  componentDidUpdate(){ this.check(); }
  componentWillUnmount(){ const p = this.player; this.player = null; if (p) p.deinitialize().catch(() => {}); }

  debug(o){ if (VOICE_DEBUG_URL) fetch(VOICE_DEBUG_URL + '/voice?data=' + encodeURIComponent(JSON.stringify(o))).catch(() => {}); }

  check(){
    const { line, enabled } = this.props;
    const id = line ? line.id : null;
    if (this.seen === undefined) { this.seen = id; return; } // baseline: don't replay the line we resumed on
    if (id === this.seen) return;
    this.seen = id;
    if (!line) return;
    if (!enabled) { this.stop(); return; }
    this.pending = line; this.flush();
  }

  flush(){
    const p = this.player, l = this.pending;
    if (!this.ready || !p || !l || !VOICE_TTS_URL) return;
    this.pending = null; this.speaking = l.id;
    try {
      p.pause();
      p.src = ttsUrl(l);
      const r = p.play(); if (r && r.catch) r.catch(e => this.debug({ type: 'playError', id: l.id, err: String(e && (e.message || e)) }));
      this.debug({ type: 'say', id: l.id, url: p.src });
    } catch (e) { this.debug({ type: 'sayError', id: l.id, err: String(e && (e.message || e)) }); }
  }

  stop(){ this.pending = null; this.speaking = null; try { if (this.player) this.player.pause(); } catch (e) {} }

  onEvent(type){
    const p = this.player;
    this.debug({ type, id: this.speaking, t: p ? p.currentTime : null, err: type === 'error' && p && p.error ? p.error.code + ' ' + p.error.message : undefined });
    if (type === 'ended' || type === 'error') this.speaking = null;
  }

  render(){ return null; }
}
