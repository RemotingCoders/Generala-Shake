// Narrator voice: assets/voice/index.html in a hidden 1×1 WebView, speaking each new narrator line with the
// WebView's speechSynthesis. Lines already on screen when the app (re)starts aren't spoken: only lines that
// appear after the first one this component saw. Never takes D-pad focus.
import React from 'react';
import { View } from 'react-native';
import { WebView } from '@amazon-devices/webview';
import { VOICE_DEBUG_URL, VOICE_TTS_URL } from '../config';

const URI = 'file:///pkg/assets/voice/index.html';

// GET /api/tts?lang&k&name&score&cat&n — the server renders the line from the template (no free text).
function ttsUrl(l){
  const q = ['lang=' + l.lang, 'k=' + encodeURIComponent(l.k)];
  for (const key of ['name', 'score', 'cat', 'n']) { const val = l.vars && l.vars[key]; if (val !== undefined && val !== null && val !== '') q.push(key + '=' + encodeURIComponent(String(val))); }
  return VOICE_TTS_URL + '?' + q.join('&');
}

export class Voice extends React.Component {
  web = React.createRef();
  ready = false; seen = undefined; pending = null;

  componentDidMount(){ this.check(); }
  componentDidUpdate(){ this.check(); }

  debug(data){ if (VOICE_DEBUG_URL) fetch(VOICE_DEBUG_URL + '/voice?data=' + encodeURIComponent(data)).catch(() => {}); }

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
    if (!this.ready || !this.pending || !this.web.current) return;
    const l = this.pending; this.pending = null;
    const json = JSON.stringify(VOICE_TTS_URL ? { id: l.id, text: l.text, lang: l.lang, url: ttsUrl(l) } : l);
    try { this.web.current.injectJavaScript('window.say&&window.say(' + json + ');true;'); } catch (e) { this.debug(JSON.stringify({ type: 'injectError', message: String(e && e.message) })); }
  }

  stop(){ this.pending = null; if (this.ready && this.web.current) try { this.web.current.injectJavaScript('window.stopVoice&&window.stopVoice();true;'); } catch (e) {} }

  onMessage = (event) => {
    const raw = event && event.nativeEvent ? event.nativeEvent.data : null;
    this.debug(String(raw));
    let d = raw; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d || typeof d !== 'object') return;
    if (d.type === 'ready') { this.ready = true; this.flush(); }
    else if (d.type === 'error') console.warn('[voice] ' + d.error);
  };

  render(){
    return (
      <View pointerEvents="none" focusable={false} style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
        <WebView
          ref={this.web}
          focusable={false}
          style={{ width: 1, height: 1 }}
          source={{ uri: URI }}
          javaScriptEnabled
          domStorageEnabled={false}
          allowSystemKeyEvents={false}
          mediaPlaybackRequiresUserAction={false}
          onMessage={this.onMessage}
          onError={(e) => this.debug(JSON.stringify({ type: 'loadError', e: e && e.nativeEvent }))}
          />
      </View>
    );
  }
}
