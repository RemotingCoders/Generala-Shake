// Generala — Fire TV host app (Vega OS / React Native for Vega).
// Host flow: home → setup → create room (POST /api/rooms) → lobby (QR) → start → live game → results.
// Live updates: GET /api/rooms/:code polled every POLL_MS; states with a lower seq are ignored.
import React from 'react';
import { AccessibilityInfo, BackHandler, View } from 'react-native';
import { api, isGone } from './api';
import { POLL_MS } from './config';
import { loadSession, saveSession, clearSession, loadPrefs, savePrefs } from './storage';
import { computeVals, screenOf } from './viewModel';
import { Home, Setup, Lobby, Playing, Results, Closed, Help } from './screens';
import { C, Txt } from './ui/components';
import { SCREEN, sx } from './ui/scale';

function detectLang(){
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || '';
    if (loc.toLowerCase().startsWith('es')) return 'es';
  } catch (e) { /* no Intl */ }
  return 'en';
}

const NET_STR = {
  es: { net_error: 'No se pudo conectar con el servidor. Reintentando…', create_error: 'No se pudo crear la sala ({code}). Probá de nuevo.' },
  en: { net_error: "Can't reach the server. Retrying…", create_error: "Couldn't create the room ({code}). Try again." },
};

// soft radial glow at the top-left (the design's radial-gradient), drawn as stacked translucent circles
const GLOW = [0, 0.08, 0.16, 0.24];

export class App extends React.Component {
  state = {
    booting: true,
    tv: { lang: detectLang(), muted: false, reduced: false, screen: 'home', helpOpen: false, goneNotice: false, setup: { variant: 'generala', mode: 'turns', narrator: true, demoLength: 'short' } },
    session: null, // { code, hostToken, joinUrl }
    game: null,    // server state
    busy: false,
    netError: false,
    toast: null,
  };

  async componentDidMount(){
    this.backSub = BackHandler.addEventListener('hardwareBackPress', this.onBack);
    // Reduced motion: on the Vega VVD this promise never settles, so it must not block the boot.
    try {
      Promise.resolve(AccessibilityInfo.isReduceMotionEnabled()).then(r => this.setTv({ reduced: !!r }), () => {});
      this.motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', r => this.setTv({ reduced: !!r }));
    } catch (e) { /* not exposed on this platform */ }
    const prefs = await loadPrefs();
    if (prefs.lang === 'es' || prefs.lang === 'en') this.setTv({ lang: prefs.lang });
    if (prefs.muted) this.setTv({ muted: true });
    const session = await loadSession();
    if (session && session.code && session.hostToken) {
      try {
        const r = await api.getRoom(session.code);
        if (r.state && !r.state.closed) { this.setState({ session, game: r.state }); this.startPolling(); }
        else await clearSession();
      } catch (e) {
        console.warn('[generala] resume failed', e.code, e.status);
        if (isGone(e)) await clearSession();
        else { this.setState({ session, netError: true }); this.startPolling(); } // server down: keep trying
      }
    }
    this.setState({ booting: false });
  }

  componentWillUnmount(){
    this.stopPolling();
    if (this.backSub) this.backSub.remove();
    if (this.motionSub && this.motionSub.remove) this.motionSub.remove();
    clearTimeout(this.toastTimer);
  }

  // onPress handlers by action id, e.g. on.start
  handlers = ['lang','vG','vY','continue','help','closeHelp','mTurns','mSimul','narr','len','create','back','start','leave','mute','pause','endGame','rematch','changeVariant','home']
    .reduce((o, id) => { o[id] = () => this.tvAct(id); return o; }, {});

  setTv(patch){ this.setState(s => ({ tv: { ...s.tv, ...(typeof patch === 'function' ? patch(s.tv) : patch) } })); }

  showToast(text){ clearTimeout(this.toastTimer); this.setState({ toast: text }); this.toastTimer = setTimeout(() => this.setState({ toast: null }), 4000); }

  // ---- live updates ----
  applyState(next){
    if (!next) return;
    this.setState(s => (s.game && next.seq < s.game.seq && next.roomCode === s.game.roomCode) ? null : { game: next, netError: false });
  }
  startPolling(){
    this.stopPolling();
    this.pollTimer = setInterval(this.poll, POLL_MS);
  }
  stopPolling(){ clearInterval(this.pollTimer); this.pollTimer = null; }
  poll = async () => {
    const { session } = this.state;
    if (!session || this.polling) return;
    this.polling = true;
    try {
      const r = await api.getRoom(session.code);
      if (this.state.session && this.state.session.code === session.code) this.applyState(r.state);
    } catch (e) {
      if (isGone(e)) this.roomGone();
      else this.setState({ netError: true });
    } finally { this.polling = false; }
  };
  roomGone(){
    this.stopPolling(); clearSession();
    this.setState({ session: null, game: null, netError: false }); this.setTv({ goneNotice: true, helpOpen: false, changing: false });
  }
  async leaveRoom(next){
    const { session } = this.state;
    this.stopPolling(); clearSession();
    this.setState({ session: null, game: null, netError: false });
    this.setTv({ screen: next, helpOpen: false, goneNotice: false, changing: false });
    if (session) { try { await api.host(session.code, session.hostToken, 'close'); } catch (e) { /* best effort */ } }
  }
  async host(action, extra){
    const { session } = this.state;
    if (!session || this.state.busy) return;
    this.setState({ busy: true });
    try {
      const r = await api.host(session.code, session.hostToken, action, extra);
      this.applyState(r.state);
    } catch (e) {
      if (isGone(e)) this.roomGone();
      else if (e.code === 'network') this.setState({ netError: true });
    } finally { this.setState({ busy: false }); }
  }
  async createRoom(){
    if (this.state.busy) return;
    this.setState({ busy: true });
    try {
      const r = await api.createRoom(this.state.tv.setup);
      const session = { code: r.code, hostToken: r.hostToken, joinUrl: r.joinUrl };
      await saveSession(session);
      this.setState({ session, game: r.state, netError: false });
      this.startPolling();
    } catch (e) {
      const nt = NET_STR[this.state.tv.lang];
      this.showToast(nt.create_error.replace('{code}', e.code || 'error'));
    } finally { this.setState({ busy: false }); }
  }

  // ---- TV actions (same ids as the web prototype) ----
  tvAct = (id) => {
    const { tv, game } = this.state;
    const setSetup = patch => this.setTv({ setup: { ...tv.setup, ...patch } });
    switch (id) {
      case 'lang': { const lang = tv.lang === 'es' ? 'en' : 'es'; this.setTv({ lang }); savePrefs({ lang, muted: tv.muted }); break; }
      case 'vG': setSetup({ variant: 'generala' }); break;
      case 'vY': setSetup({ variant: 'yahtzee' }); break;
      case 'continue': this.setTv({ screen: 'setup' }); break;
      case 'help': this.setTv({ helpOpen: true }); break;
      case 'closeHelp': this.setTv({ helpOpen: false }); break;
      case 'mTurns': setSetup({ mode: 'turns' }); break;
      case 'mSimul': setSetup({ mode: 'simul' }); break;
      case 'narr': setSetup({ narrator: !tv.setup.narrator }); break;
      case 'len': setSetup({ demoLength: tv.setup.demoLength === 'short' ? 'full' : 'short' }); break;
      case 'create':
        // "Change variant" from results: same room and players, new rules (host rematch with overrides)
        if (tv.changing && this.state.session) { this.host('rematch', tv.setup).then(() => this.setTv({ changing: false })); }
        else this.createRoom();
        break;
      case 'back': this.setTv({ screen: 'home' }); break;
      case 'start': if (game && game.players.length >= 2) this.host('start'); break;
      case 'leave': this.leaveRoom('setup'); break;
      case 'mute': { const muted = !tv.muted; this.setTv({ muted }); savePrefs({ lang: tv.lang, muted }); break; }
      case 'pause': if (game) this.host(game.paused ? 'resume' : 'pause'); break;
      case 'endGame': this.host('end'); break;
      case 'rematch': this.host('rematch'); break;
      case 'changeVariant':
        if (game) this.setTv({ changing: true, screen: 'home', setup: { variant: game.variant, mode: game.mode, narrator: game.narrator !== false, demoLength: game.demoLength || 'full' } });
        break;
      case 'home': if (this.state.session) this.leaveRoom('home'); else this.setTv({ screen: 'home', goneNotice: false }); break;
    }
  };

  // Back key: close overlays / step back; on the home screen let Vega handle it (exit app).
  onBack = () => {
    const { tv, game } = this.state;
    const screen = screenOf(tv, game);
    switch (screen) {
      case 'help': this.tvAct('closeHelp'); return true;
      case 'setup': this.tvAct('back'); return true;
      case 'lobby': this.tvAct('leave'); return true;
      case 'playing': this.tvAct('pause'); return true;
      case 'results': this.tvAct('home'); return true;
      case 'closed': this.tvAct('home'); return true;
      case 'home': if (tv.changing) { this.setTv({ changing: false }); return true; } return false;
      default: return false;
    }
  };

  render(){
    const { tv, game, booting, session } = this.state;
    const screen = screenOf(tv, game);
    const v = computeVals(tv, game);
    const on = this.handlers;
    let body = null;
    if (!booting) {
      if (screen === 'help') body = <Help key="help" v={v} on={on} />;
      else if (screen === 'home') body = <Home key="home" v={v} on={on} />;
      else if (screen === 'setup') body = <Setup key="setup" v={v} on={on} busy={this.state.busy} changing={!!tv.changing} />;
      else if (screen === 'lobby') body = <Lobby key={'lobby' + game.roomCode} v={v} on={on} joinUrl={session && session.joinUrl} />;
      else if (screen === 'playing') body = <Playing key={'playing' + (v.isPaused ? 'p' : '')} v={v} on={on} />;
      else if (screen === 'results') body = <Results key="results" v={v} on={on} />;
      else if (screen === 'closed') body = <Closed key="closed" v={v} on={on} />;
    }
    const banner = this.state.netError ? NET_STR[tv.lang].net_error : this.state.toast;
    return (
      <View style={{ width: SCREEN.width, height: SCREEN.height, backgroundColor: C.bg, overflow: 'hidden' }}>
        {GLOW.map((g, i) => <View key={i} pointerEvents="none" style={{ position: 'absolute', top: SCREEN.height * (-0.1 - g), left: SCREEN.width * (0.2 - g) - SCREEN.width * 0.25, width: SCREEN.width * (0.5 + 2 * g), height: SCREEN.width * (0.5 + 2 * g), borderRadius: SCREEN.width, backgroundColor: '#3A2A24', opacity: 0.12 }} />)}
        {body}
        {banner ? (
          <View pointerEvents="none" style={sx({ position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center' })}>
            <View style={sx({ backgroundColor: C.focus, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 })}>
              <Txt style={{ fontSize: 20, fontWeight: '800', color: C.inkDark }}>{banner}</Txt>
            </View>
          </View>
        ) : null}
      </View>
    );
  }
}
