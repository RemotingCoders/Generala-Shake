import React from 'react';
import * as E from '../shared/engine.js';
import * as I from '../shared/i18n.js';
import GeneralaPhone from './GeneralaPhone.jsx';
import { rooms, watchRoom, isOffline, store } from './api.js';

const PREF = 'generala.phone.pref';       // { lang, name, color, motion, motionDone } — per device
const SESSION = 'generala.phone.session'; // { code, playerToken, playerId } — so a reload rejoins
const ROOM_GONE = ['notfound', 'expired', 'closed'];

const handOf = (g, pid) => g.mode === 'simul' ? g.hands[pid] : g.hand;
const isMyTurn = (g, pid) => !!g && g.phase === 'playing' && !g.paused && (g.mode === 'turns' ? g.players[g.activeIdx]?.id === pid : !!g.hands[pid] && !g.hands[pid].done);
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

export default class PhoneApp extends React.Component {
  constructor(props){
    super(props);
    const pref = store.get(PREF) || {};
    this.seq = -1;
    this.state = {
      game: null, code: null, me: null, token: null,
      lang: pref.lang || I.detectLang(), nameDraft: pref.name || '', color: pref.color || null, codeDraft: '', manualMode: false, error: null,
      motion: pref.motion === 'granted' ? 'granted' : 'idle', motionDone: !!pref.motionDone, tab: 'dice', pick: null, confirmZero: null,
      offline: false, busy: false, joining: false, showRules: false, shakeTs: 0,
      reduced: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }

  componentDidMount(){
    const urlRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 4);
    const sess = store.get(SESSION);
    if (sess && (!urlRoom || urlRoom === sess.code)) this.rejoin(sess);
    else if (urlRoom) this.openRoom(urlRoom);
    this.pingTimer = setInterval(() => this.ping(), 10000);
    document.addEventListener('visibilitychange', this.onVisible);
    if (this.state.motion === 'granted') this.resumeMotion();
  }
  componentWillUnmount(){ clearInterval(this.pingTimer); clearTimeout(this.retryTimer); document.removeEventListener('visibilitychange', this.onVisible); this.unwatch(); window.removeEventListener('devicemotion', this.onMotion); }

  savePref(patch){ store.set(PREF, { ...(store.get(PREF) || {}), ...patch }); }
  onVisible = () => { if (document.visibilityState === 'visible') this.ping(); };

  // ---- room lifecycle ----
  watch(code){
    this.unwatch();
    this.unwatchFn = watchRoom(code, {
      onState: s => this.applyState(s),
      onOk: () => this.state.offline && this.setState({ offline: false }),
      onError: c => c === 'offline' ? this.setState({ offline: true }) : ROOM_GONE.includes(c) && this.roomGone(c),
    });
  }
  unwatch(){ if (this.unwatchFn) { this.unwatchFn(); this.unwatchFn = null; } }

  applyState(s, direct){
    if (!s || s.seq < this.seq || (!direct && s.seq === this.seq)) return;
    this.seq = s.seq;
    const { me, game: prev } = this.state;
    if (me && !s.players.some(p => p.id === me)) { store.set(SESSION, null); this.setState({ game: s, me: null, token: null }); return; }
    const patch = { game: s };
    if (me && s.closed) { this.roomGone('closed'); return; }
    if (me && isMyTurn(s, me) && !isMyTurn(prev, me)) { vibrate(150); patch.tab = 'dice'; patch.pick = null; patch.confirmZero = null; }
    if (me && !isMyTurn(s, me)) { patch.pick = null; patch.confirmZero = null; }
    this.setState(patch);
  }

  roomGone(code){
    this.unwatch(); store.set(SESSION, null);
    this.setState({ error: code, game: null, me: null, token: null, offline: false, busy: false });
  }

  async openRoom(code){
    this.seq = -1;
    this.setState({ code, error: null });
    try {
      const r = await rooms.get(code);
      this.setState({ offline: false, manualMode: false }); this.applyState(r.state, true);
      if (r.state.closed) return this.roomGone('closed');
      const blocked = r.state.phase !== 'lobby' ? 'started' : r.state.players.length >= E.MAX_PLAYERS ? 'full' : null;
      if (blocked) { this.seq = -1; return this.setState({ error: blocked, game: null }); }
      history.replaceState(null, '', '?room=' + code);
      this.watch(code);
    } catch (e) {
      if (isOffline(e)) { this.setState({ offline: true }); this.retryTimer = setTimeout(() => this.openRoom(code), 2000); }
      else this.setState({ error: ROOM_GONE.includes(e.code) ? e.code : 'notfound', game: null });
    }
  }

  async rejoin(sess){
    this.seq = -1;
    this.setState({ code: sess.code });
    try {
      const pref = store.get(PREF) || {};
      const r = await rooms.join(sess.code, { name: pref.name || 'Player', color: pref.color, playerToken: sess.playerToken });
      this.joined(sess.code, r);
    } catch (e) {
      if (isOffline(e)) { this.setState({ offline: true }); this.retryTimer = setTimeout(() => this.rejoin(sess), 2000); return; }
      store.set(SESSION, null);
      this.setState({ error: ['notfound', 'expired', 'closed', 'started', 'full'].includes(e.code) ? e.code : 'notfound' });
    }
  }

  joined(code, r){
    store.set(SESSION, { code, playerToken: r.playerToken, playerId: r.playerId });
    const color = r.state.players.find(p => p.id === r.playerId)?.color;
    if (color) this.savePref({ color });
    history.replaceState(null, '', '?room=' + code);
    this.setState({ me: r.playerId, token: r.playerToken, code, offline: false, error: null, joining: false, color: color || this.state.color });
    this.applyState(r.state, true);
    this.watch(code);
  }

  async ping(){
    if (!this.state.me || document.visibilityState !== 'visible') return;
    await this.play('ping');
  }

  // POST /play; returns the new state or null
  async play(action, extra){
    const { code, token } = this.state;
    try {
      const r = await rooms.play(code, token, action, extra);
      if (this.state.offline) this.setState({ offline: false });
      this.applyState(r.state, true); return r.state;
    } catch (e) {
      if (isOffline(e)) this.setState({ offline: true });
      else if (ROOM_GONE.includes(e.code)) this.roomGone(e.code);
      else if (e.code === 'unauthorized') { store.set(SESSION, null); this.setState({ me: null, token: null }); }
      return null;
    }
  }

  // ---- UI actions (same verbs as the prototype) ----
  act = async (action, arg) => {
    const st = this.state; const g = st.game;
    if (st.offline && !['reconnect', 'lang'].includes(action)) return;
    switch (action) {
      case 'lang': { const lang = st.lang === 'es' ? 'en' : 'es'; this.savePref({ lang }); this.setState({ lang }); break; }
      case 'name': this.setState({ nameDraft: arg }); break;
      case 'code': this.setState({ codeDraft: arg.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4), error: null }); break;
      case 'manual': this.setState({ manualMode: !st.manualMode, error: null }); break;
      case 'find': if (st.codeDraft.length === 4) { this.unwatch(); this.openRoom(st.codeDraft); } break;
      case 'clearError': this.unwatch(); this.seq = -1; history.replaceState(null, '', location.pathname); this.setState({ error: null, codeDraft: '', game: null, code: null, manualMode: false }); break;
      case 'color': if (g && !g.players.some(p => p.color === arg)) this.setState({ color: arg }); break;
      case 'join': {
        const name = (st.nameDraft || '').trim(); if (!name || st.joining || !g) return;
        this.setState({ joining: true }); this.savePref({ name });
        try { this.joined(st.code, await rooms.join(st.code, { name, color: this.pickColor() })); }
        catch (e) { this.setState({ joining: false }); if (isOffline(e)) this.setState({ offline: true }); else this.setState({ error: e.code === 'badRequest' ? 'notfound' : e.code }); }
        break;
      }
      case 'motionAllow': this.requestMotion(); break;
      case 'motionSkip': this.savePref({ motionDone: true }); this.setState({ motionDone: true }); break;
      case 'tab': this.setState({ tab: arg }); break;
      case 'rules': this.setState({ showRules: !st.showRules }); break;
      case 'roll': {
        if (st.busy || !isMyTurn(g, st.me) || handOf(g, st.me).rollsLeft <= 0) return;
        this.setState({ busy: true, pick: null });
        const t0 = Date.now(); const s = await this.play('roll');
        setTimeout(() => { const h = s && handOf(s, st.me); this.setState(h && h.rollsLeft === 0 ? { busy: false, tab: 'sheet' } : { busy: false }); }, Math.max(0, 600 - (Date.now() - t0)));
        break;
      }
      case 'hold': {
        const r = E.toggleHold(g, st.me, arg); if (r.error) return;
        this.setState({ game: { ...r.state, seq: g.seq } }); // optimistic; the server's answer replaces it
        this.play('hold', { index: arg }); break;
      }
      case 'pick': this.setState({ pick: arg }); break;
      case 'confirm': {
        if (!st.pick || st.busy) return;
        const pot = E.handPotential(g, st.me); if (!pot) return;
        if (pot.scores[st.pick] === 0 && !arg) { this.setState({ confirmZero: st.pick }); return; }
        this.setState({ busy: true });
        const s = await this.play('choose', { cat: st.pick });
        this.setState(s ? { busy: false, pick: null, confirmZero: null, tab: 'dice' } : { busy: false, pick: null, confirmZero: null });
        break;
      }
      case 'cancelZero': this.setState({ confirmZero: null }); break;
      case 'reconnect': if (st.me) this.ping(); else if (st.code) this.openRoom(st.code); else this.setState({ offline: false }); break;
    }
  };

  pickColor(){
    const g = this.state.game; if (!g) return this.state.color;
    const taken = g.players.filter(p => p.id !== this.state.me).map(p => p.color);
    return this.state.color && !taken.includes(this.state.color) ? this.state.color : E.COLORS.find(c => !taken.includes(c)) || null;
  }

  // ---- shake to roll ----
  onMotion = (ev) => {
    this.gotMotion = true;
    const a = ev.accelerationIncludingGravity || ev.acceleration; if (!a) return;
    const m = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    if (m > 22 && Date.now() - this.state.shakeTs > 900 && this.state.tab === 'dice') { this.setState({ shakeTs: Date.now() }); this.act('roll'); }
  };
  async requestMotion(){
    const DM = window.DeviceMotionEvent;
    const done = motion => { this.savePref({ motion, motionDone: true }); this.setState({ motion, motionDone: true }); };
    if (!DM) return done('unavailable');
    try { if (typeof DM.requestPermission === 'function' && await DM.requestPermission() !== 'granted') return done('denied'); }
    catch (e) { return done('denied'); }
    this.gotMotion = false;
    window.addEventListener('devicemotion', this.onMotion);
    setTimeout(() => { if (!this.gotMotion) { window.removeEventListener('devicemotion', this.onMotion); done('unavailable'); } else done('granted'); }, 1500);
  }
  // after a reload: Android just works; iOS needs requestPermission again from a user gesture, so ask on the first tap
  resumeMotion(){
    window.addEventListener('devicemotion', this.onMotion);
    const DM = window.DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === 'function') {
      const once = () => { DM.requestPermission().catch(() => {}); };
      document.addEventListener('click', once, { once: true, capture: true });
    }
  }

  render(){
    const st = this.state; const lang = st.lang;
    const t = (k, v) => { const s = (I.STR[lang] || I.STR.en)[k] || k; return v ? I.fmt(s, v) : s; };
    const phone = {
      ...st, id: st.me, color: st.me ? st.color : this.pickColor(), act: this.act, t, cat: (variant, c) => I.CATS[variant][lang][c] || c, E, I, rules: I.RULES,
    };
    return (
      <div style={{ width: '100%', height: '100dvh', background: '#FFF9EE' }}>
        <GeneralaPhone phone={phone} />
      </div>
    );
  }
}
