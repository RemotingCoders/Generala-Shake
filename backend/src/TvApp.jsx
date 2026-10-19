import React from 'react';
import * as E from '../shared/engine.js';
import * as I from '../shared/i18n.js';
import GeneralaTV from './GeneralaTV.jsx';
import { rooms, watchRoom, getConfig, isOffline, store } from './api.js';

// Web host (debugging / fallback for the Fire TV app): same screens, real API.
const PREF = 'generala.tv.pref';       // { lang }
const SESSION = 'generala.tv.session'; // { code, hostToken }

export default class TvApp extends React.Component {
  FOCUS = {
    home: ['vG','vY','continue','help','lang'],
    setup: ['mTurns','mSimul','narr','len','create','back'],
    lobby: ['start','leave','lang'],
    playing: ['help','mute','pause','lang'],
    paused: ['pause','endGame','home'],
    results: ['rematch','changeVariant','home','lang'],
    closed: ['home'],
    help: ['closeHelp'],
  };

  constructor(props){
    super(props);
    const pref = store.get(PREF) || {};
    this.seq = -1;
    this.state = {
      game: null, session: null, gone: false, offline: false, busy: false, publicUrl: '', scale: 1,
      tv: { lang: pref.lang || I.detectLang(), screen: 'home', setup: { variant: 'generala', mode: 'turns', narrator: true, demoLength: 'short' }, focus: 0, helpOpen: false, muted: false, override: false,
        reduced: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches },
    };
  }

  componentDidMount(){
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.measure); this.measure();
    getConfig().then(c => this.setState({ publicUrl: c.publicUrl })).catch(() => {});
    const sess = store.get(SESSION);
    if (sess) this.resume(sess);
  }
  componentWillUnmount(){ window.removeEventListener('keydown', this.onKey); window.removeEventListener('resize', this.measure); this.unwatch(); clearTimeout(this.settleTimer); clearTimeout(this.staleTimer); }
  componentDidUpdate(){ const sc = this.tvScreen(); if (sc !== this.lastScreen) { this.lastScreen = sc; if (this.state.tv.focus) this.setTv({ focus: 0 }); } }

  measure = () => { const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720); if (s !== this.state.scale) this.setState({ scale: s }); };

  // ---- room lifecycle ----
  async resume(sess){
    try { const r = await rooms.get(sess.code); if (r.state.closed) throw new Error('closed'); this.attach(sess, r.state); }
    catch (e) { if (isOffline(e) && e.code === 'offline') { this.setState({ offline: true }); setTimeout(() => this.resume(sess), 2000); } else store.set(SESSION, null); }
  }
  attach(session, state){
    store.set(SESSION, session);
    this.seq = -1; this.setState({ session, gone: false, offline: false });
    this.applyState(state, true);
    this.unwatch();
    this.unwatchFn = watchRoom(session.code, {
      onState: s => this.applyState(s),
      onOk: () => this.state.offline && this.setState({ offline: false }),
      onError: c => c === 'offline' ? this.setState({ offline: true }) : (c === 'notfound' || c === 'expired') && this.roomGone(),
    });
  }
  unwatch(){ if (this.unwatchFn) { this.unwatchFn(); this.unwatchFn = null; } }
  detach(){ this.unwatch(); store.set(SESSION, null); this.seq = -1; this.setState({ game: null, session: null }); }
  roomGone(){ this.detach(); this.setState({ gone: true }); }
  applyState(s, direct){
    if (!s || s.seq < this.seq || (!direct && s.seq === this.seq)) return;
    this.seq = s.seq; this.trackDice(s); this.setState({ game: s });
  }
  // turn-based tray: while the 3D dice land (MIN_SPIN_MS + DICE_SETTLE_MS) the sheet hides the new potential scores,
  // and a shake that went stale (E.isShaking, 8 s) needs a re-render to stop showing.
  trackDice(s){
    const h = s.mode === 'turns' && s.phase === 'playing' ? s.hand : null;
    const key = h && h.rolled ? [s.round, s.activeIdx, h.rollId || 0].join('|') : null;
    if (key && this.rollKey !== undefined && key !== this.rollKey && this.dice3dReady) {
      const ms = E.DICE_SETTLE_MS + (this.prevShaking ? 0 : E.MIN_SPIN_MS);
      this.settleUntil = Date.now() + ms; clearTimeout(this.settleTimer); this.settleTimer = setTimeout(() => this.forceUpdate(), ms + 20);
    }
    this.rollKey = key; this.prevShaking = !!(h && h.shaking);
    clearTimeout(this.staleTimer);
    if (h && h.shaking) this.staleTimer = setTimeout(() => this.forceUpdate(), Math.max(0, (h.shakeTs || 0) + 8001 - Date.now()));
  }
  onDice3d = status => { this.dice3dReady = status === 'ready'; };

  async host(action, extra){
    const { session } = this.state; if (!session || this.state.busy) return null;
    this.setState({ busy: true });
    try { const r = await rooms.host(session.code, session.hostToken, action, extra); this.setState({ busy: false, offline: false }); this.applyState(r.state, true); return r.state; }
    catch (e) {
      this.setState({ busy: false });
      if (isOffline(e)) this.setState({ offline: true });
      else if (e.code === 'expired' || e.code === 'notfound' || e.code === 'unauthorized') this.roomGone();
      return null;
    }
  }

  // fire-and-forget: the TV is leaving this room, its answer must not bring it back
  closeRoom(){ const { session, game } = this.state; if (session && game && !game.closed) rooms.host(session.code, session.hostToken, 'close').catch(() => {}); }

  // ---- TV actions (same ids as the prototype) ----
  setTv(patch){ this.setState(s => ({ tv: { ...s.tv, ...(typeof patch === 'function' ? patch(s.tv) : patch) } })); }
  tvScreen(){
    const { game: g, tv, gone } = this.state;
    if (tv.helpOpen) return 'help';
    if (gone) return 'closed';
    if (g && !tv.override) { if (g.closed) return 'closed'; if (g.phase === 'playing' && g.paused) return 'paused'; return g.phase; }
    return tv.screen;
  }
  tvAct = async (id) => {
    const { tv, game } = this.state;
    const screen = this.tvScreen();
    switch (id) {
      case 'lang': { const lang = tv.lang === 'es' ? 'en' : 'es'; store.set(PREF, { lang }); this.setTv({ lang }); break; }
      case 'vG': this.setTv({ setup: { ...tv.setup, variant: 'generala' } }); break;
      case 'vY': this.setTv({ setup: { ...tv.setup, variant: 'yahtzee' } }); break;
      case 'continue': this.setTv({ screen: 'setup', focus: 0 }); break;
      case 'help': this.setTv({ helpOpen: true, focus: 0 }); break;
      case 'closeHelp': this.setTv({ helpOpen: false, focus: 0 }); break;
      case 'mTurns': this.setTv({ setup: { ...tv.setup, mode: 'turns' } }); break;
      case 'mSimul': this.setTv({ setup: { ...tv.setup, mode: 'simul' } }); break;
      case 'narr': this.setTv({ setup: { ...tv.setup, narrator: !tv.setup.narrator } }); break;
      case 'len': this.setTv({ setup: { ...tv.setup, demoLength: tv.setup.demoLength === 'short' ? 'full' : 'short' } }); break;
      case 'create': {
        if (this.state.busy) return;
        // "Change variant" keeps the room and its players: a rematch with the new rules
        if (game && tv.override && !game.closed) { if (await this.host('rematch', tv.setup)) this.setTv({ override: false, focus: 0 }); break; }
        this.setState({ busy: true });
        try { const r = await rooms.create(tv.setup); this.setState({ busy: false }); this.attach({ code: r.code, hostToken: r.hostToken }, r.state); this.setTv({ focus: 0, override: false }); }
        catch (e) { this.setState({ busy: false, offline: isOffline(e) }); }
        break;
      }
      case 'back': if (screen === 'setup') this.setTv(tv.override ? { override: false, focus: 0 } : { screen: 'home', focus: 0 }); break;
      case 'start': if (game && game.players.length >= E.MIN_PLAYERS) this.host('start'); break;
      case 'leave': this.closeRoom(); this.detach(); this.setTv({ screen: 'home', focus: 0 }); break;
      case 'mute': this.setTv({ muted: !tv.muted }); break;
      case 'pause': if (game) this.host(game.paused ? 'resume' : 'pause'); break;
      case 'endGame': this.host('end'); break;
      case 'rematch': this.host('rematch'); break;
      case 'changeVariant': if (game) this.setTv({ override: true, screen: 'setup', focus: 0, setup: { variant: game.variant, mode: game.mode, narrator: game.narrator, demoLength: game.demoLength } }); break;
      case 'home': this.closeRoom(); this.detach(); this.setState({ gone: false }); this.setTv({ screen: 'home', focus: 0, override: false }); break;
    }
  };
  onKey = (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const list = this.FOCUS[this.tvScreen()] || []; const tv = this.state.tv; const k = e.key;
    if (!list.length) return;
    if (['ArrowRight','ArrowDown'].includes(k)) { e.preventDefault(); this.setTv({ focus: (tv.focus + 1) % list.length }); }
    else if (['ArrowLeft','ArrowUp'].includes(k)) { e.preventDefault(); this.setTv({ focus: (tv.focus - 1 + list.length) % list.length }); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); this.tvAct(list[tv.focus % list.length]); }
    else if (k === 'Backspace' || k === 'Escape') { e.preventDefault(); if (tv.helpOpen) this.tvAct('closeHelp'); else this.tvAct('back'); }
  };

  // ---- narrator text for an event (state.events), as in the prototype ----
  t(lang, key, vars){ const s = (I.STR[lang] || I.STR.en)[key] || key; return vars ? I.fmt(s, vars) : s; }
  cat(lang, variant, c){ return I.CATS[variant][lang][c] || c; }
  feedText(lang, ev){ const l = I.narratorLine(lang, this.state.game, ev); return l ? l.text : null; }

  render(){
    const { game, tv, scale, publicUrl, offline } = this.state;
    const screen = this.tvScreen(); const list = this.FOCUS[screen] || [];
    const joinUrl = game && publicUrl ? `${publicUrl}/?room=${game.roomCode}` : '';
    const props = {
      game: this.state.gone ? null : game, tv: { ...tv, feed: (game && game.events) || [], settling: Date.now() < (this.settleUntil || 0), onDice3d: this.onDice3d }, act: this.tvAct, screen, focusId: list[tv.focus % (list.length || 1)],
      t: (k, v) => this.t(tv.lang, k, v), cat: (variant, c) => this.cat(tv.lang, variant, c), feedText: (ev) => this.feedText(tv.lang, ev), E, I,
      joinUrl, joinHost: publicUrl.replace(/^https?:\/\//, ''),
    };
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#15110F', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <div style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: 'center', overflow: 'hidden', flex: 'none', position: 'relative' }}>
          <GeneralaTV tv={props} />
          {offline && <div style={{ position: 'absolute', right: 24, bottom: 20, background: '#FFD166', color: '#1E1715', borderRadius: 999, padding: '10px 22px', fontWeight: 800, fontSize: 20, fontFamily: "'Nunito',system-ui,sans-serif" }}>{this.t(tv.lang, 'reconnecting')}</div>}
        </div>
      </div>
    );
  }
}
