import React from 'react';

// Embeds the shared 3D dice view (/dice3d/index.html, synced from shared/dice3d/) and drives it with
// contentWindow.diceUpdate(msg) — protocol in docs/ARCHITECTURE.md "3D dice view".
// Shows `fallback` (the 2D dice) until the view says `ready`, and for good if it reports `error`
// or never becomes ready within READY_TIMEOUT_MS.
// `msg.rollKey` (any string) identifies one roll; it is mapped to an increasing int `rollId` here because the
// engine's hand.rollId restarts with every fresh hand (next player / next round).
const READY_TIMEOUT_MS = 4000;
const SRC = '/dice3d/index.html';

export default class Dice3D extends React.Component {
  state = { status: 'loading' }; // loading | ready | failed
  frame = React.createRef();
  rollId = 0; lastKey = undefined; lastSent = null;

  componentDidMount(){
    window.addEventListener('message', this.onMessage);
    this.timer = setTimeout(() => { if (this.state.status === 'loading') this.fail('timeout'); }, READY_TIMEOUT_MS);
  }
  componentWillUnmount(){ window.removeEventListener('message', this.onMessage); clearTimeout(this.timer); }
  componentDidUpdate(_, prev){ this.push(); if (prev.status !== this.state.status && this.props.onStatus) this.props.onStatus(this.state.status); }

  fail(reason){ clearTimeout(this.timer); if (this.state.status !== 'failed') { console.warn('[dice3d] fallback to 2D:', reason); this.setState({ status: 'failed' }); } }

  onMessage = (ev) => {
    const f = this.frame.current;
    if (!f || ev.source !== f.contentWindow) return;
    let d = ev.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d || typeof d !== 'object') return;
    if (d.type === 'ready') { clearTimeout(this.timer); this.lastSent = null; if (this.state.status !== 'failed') this.setState({ status: 'ready' }, () => this.push(true)); }
    else if (d.type === 'error') this.fail(d.message || 'error');
    else if (d.type === 'settled' && this.props.onSettled) this.props.onSettled(d);
  };

  message(){
    const { rollKey, ...m } = this.props.msg;
    if (m.rolled && rollKey !== this.lastKey) { this.lastKey = rollKey; this.rollId++; }
    return { type: 'dice', ...m, rollId: this.rollId };
  }

  push(force){
    if (this.state.status !== 'ready') return;
    const w = this.frame.current && this.frame.current.contentWindow; if (!w) return;
    const msg = this.message(); const json = JSON.stringify(msg);
    if (!force && json === this.lastSent) return;
    this.lastSent = json;
    try { if (typeof w.diceUpdate === 'function') w.diceUpdate(msg); else w.postMessage(msg, '*'); }
    catch (e) { this.fail(e.message); }
  }

  render(){
    const { status } = this.state;
    if (status !== 'ready') this.message(); // keep the roll counter in step while the 2D dice are showing
    return (
      <div data-dice3d={status} style={{ position: 'relative', width: '100%', height: '100%' }}>
        {status !== 'failed' && (
          <iframe ref={this.frame} src={SRC} title="dice" onError={() => this.fail('load')}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: 'transparent', visibility: status === 'ready' ? 'visible' : 'hidden' }}
            allowtransparency="true" />
        )}
        {status !== 'ready' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{this.props.fallback}</div>}
      </div>
    );
  }
}
