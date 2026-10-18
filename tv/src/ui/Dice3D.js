// 3D dice: shared/dice3d/index.html (synced into tv/assets/dice3d/) in a WebView, driven with
// injectJavaScript('window.diceUpdate(msg)') — protocol in docs/ARCHITECTURE.md "3D dice view".
// Shows `fallback` (the 2D dice row) until the page reports `ready`, and for good if it reports `error`,
// fails to load, or isn't ready within READY_TIMEOUT_MS. The WebView never takes D-pad focus.
import React from 'react';
import { View } from 'react-native';
import { WebView } from '@amazon-devices/webview';
import { DICE3D_DEBUG_URL } from '../config';

const READY_TIMEOUT_MS = 12000;
const BASE_URI = 'file:///pkg/assets/dice3d/index.html';

export class Dice3D extends React.Component {
  state = { status: 'loading' }; // loading | ready | failed
  web = React.createRef();
  rollId = 0; lastKey = undefined; lastSent = null; keyById = {};
  reportedKey = undefined;
  uri = BASE_URI + '?bg=' + (this.props.bg || '24201B').replace('#', '') + (DICE3D_DEBUG_URL ? '&debug=1' : '');

  componentDidMount(){ this.timer = setTimeout(() => { if (this.state.status === 'loading') this.fail('timeout'); }, READY_TIMEOUT_MS); }
  componentWillUnmount(){ clearTimeout(this.timer); this.unmounted = true; }
  componentDidUpdate(){
    this.push(false);
    // 2D fallback: nothing to wait for, a roll has "landed" as soon as it is shown.
    const key = this.props.msg && this.props.msg.rollKey;
    if (this.state.status === 'failed' && key !== this.reportedKey && this.props.onSettled) { this.reportedKey = key; this.props.onSettled({ type: 'settled', rollKey: key, fallback: true }); }
  }

  debug(data){ if (DICE3D_DEBUG_URL) fetch(DICE3D_DEBUG_URL + '/dice3d?data=' + encodeURIComponent(data)).catch(() => {}); }

  fail(reason){
    clearTimeout(this.timer);
    console.warn('[dice3d] fallback to 2D: ' + reason);
    this.debug(JSON.stringify({ type: 'fallback', reason: String(reason) }));
    if (!this.unmounted && this.state.status !== 'failed') this.setState({ status: 'failed' });
  }

  onMessage = (event) => {
    const raw = event && event.nativeEvent ? event.nativeEvent.data : null;
    let d = raw; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d || typeof d !== 'object') return;
    this.debug(typeof raw === 'string' ? raw : JSON.stringify(d));
    if (d.type === 'ready') {
      clearTimeout(this.timer);
      if (this.state.status === 'failed') return;
      if (this.state.status !== 'ready') this.setState({ status: 'ready' });
      this.push(true);
    } else if (d.type === 'error') this.fail(d.message || 'error');
    else if (d.type === 'settled') {
      console.info('[dice3d] settled ' + JSON.stringify(d));
      if (this.props.onSettled) this.props.onSettled({ ...d, rollKey: this.keyById[d.rollId] });
    }
  };

  // Maps the view model's rollKey (unique per roll) to the increasing int rollId of the protocol.
  message(){
    const { rollKey, ...m } = this.props.msg;
    if (m.rolled && rollKey !== this.lastKey) { this.lastKey = rollKey; this.rollId++; this.keyById[this.rollId] = rollKey; }
    return { type: 'dice', ...m, rollId: this.rollId };
  }

  push(force){
    const msg = this.message(); // keeps the roll counter in step even while the 2D fallback shows
    if (this.state.status !== 'ready' || !this.web.current) return; // after a failure nothing is injected
    const json = JSON.stringify(msg);
    if (!force && json === this.lastSent) return;
    this.lastSent = json;
    try { this.web.current.injectJavaScript('window.diceUpdate&&window.diceUpdate(' + json + ');true;'); }
    catch (e) { this.fail(e && e.message); }
  }

  render(){
    const { status } = this.state;
    const { style, fallback, bgColor = '#24201B' } = this.props;
    if (status !== 'ready') this.message();
    return (
      <View style={[{ overflow: 'hidden' }, style]} focusable={false}>
        {/* Kept mounted even after a failure: unmounting the Vega WebView from its error callback crashed the app. */}
        <WebView
          ref={this.web}
          focusable={false}
          style={{ flex: 1, backgroundColor: bgColor }}
          source={{ uri: this.uri }}
          javaScriptEnabled
          domStorageEnabled={false}
          allowSystemKeyEvents={false}
          allowsDefaultMediaControl={false}
          onMessage={this.onMessage}
          onError={(e) => this.fail('load ' + JSON.stringify(e && e.nativeEvent))}
          onHttpError={(e) => { if (!e || !e.nativeEvent || e.nativeEvent.isMainFrame !== false) this.fail('http ' + (e && e.nativeEvent && e.nativeEvent.statusCode)); }}
          />
        {status !== 'ready' ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
            {fallback}
          </View>
        ) : null}
      </View>
    );
  }
}
