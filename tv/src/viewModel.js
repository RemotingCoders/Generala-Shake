// Display-only derivations from the server state (port of computeVals/feedText from the web prototype).
// Never computes game outcomes: phase, winners, turns and scores come from the server. Engine helpers are
// used only for display (totals, potentials, round count).
import * as E from './shared/engine';
import * as I from './shared/i18n';
import { C } from './ui/components';
import { TV_STR } from './strings';

// Live shake of the active hand. Staleness (a phone that died mid-shake) is measured from the moment this TV
// first saw that shake, so a clock difference between the TV and the server can't hide or prolong it.
const SHAKE_STALE_MS = E.SHAKE_STALE_MS || 8000;
let shakeSeen = { key: null, at: 0 };
// A new roll is "landing" while the 3D dice brake onto it: until the view reports `settled` for that rollKey
// (tv.landedKey) or, as a safety net, DICE_SETTLE_MS + 1.5 s after this TV first saw the roll.
const LANDING_MAX_MS = (E.DICE_SETTLE_MS || 5000) + 1500;
let rollSeen = { key: null, at: 0 };
export function landingNow(key, landedKey, now = Date.now()){
  if (!key || key === landedKey) return false;
  if (rollSeen.key !== key) rollSeen = { key, at: now };
  return now - rollSeen.at < LANDING_MAX_MS;
}
export function shakingNow(h, now = Date.now(), pid = ''){
  if (!h || !h.shaking) return false;
  const key = pid + ':' + (h.shakeTs || 0);
  if (shakeSeen.key !== key) shakeSeen = { key, at: now };
  return now - shakeSeen.at < SHAKE_STALE_MS;
}

export const t = (lang, key, vars) => { const s = (I.STR[lang] || I.STR.en)[key] || key; return vars ? I.fmt(s, vars) : s; };
export const catName = (lang, variant, c) => (I.CATS[variant] && I.CATS[variant][lang][c]) || c;
const initial = n => (n || '?').trim().charAt(0).toUpperCase();

// Narrator line for an event: { k (NARRATOR key), v (variant), vars, text } or null. k + vars also drive /api/tts.
export const feedLine = (lang, g, ev) => I.narratorLine(lang, g, ev);

export function feedText(lang, g, ev){
  const l = feedLine(lang, g, ev);
  return l ? l.text : null;
}

export function screenOf(tv, g){
  if (tv.helpOpen) return 'help';
  if (tv.goneNotice) return 'closed';
  if (g) {
    if (g.closed) return 'closed';
    if (tv.changing && g.phase === 'results') return tv.screen; // picking new rules for a rematch
    return g.phase;
  }
  return tv.screen;
}

export function computeVals(tv, g){
  const lang = tv.lang;
  const T = { ...I.STR[lang], hold_tag: lang === 'es' ? 'Se queda' : 'Kept' };
  const tt = (k, vars) => t(lang, k, vars);
  const fromSetup = !g || (tv.changing && g.phase === 'results'); // picking rules (new room or change variant)
  const variant = fromSetup ? tv.setup.variant : g.variant;
  const accent = variant === 'generala' ? C.generala : C.yahtzee;
  const variantName = tt(variant === 'generala' ? 'v_generala' : 'v_yahtzee');
  const mode = fromSetup ? tv.setup.mode : g.mode;
  const modeName = tt(mode === 'turns' ? 'mode_turns' : 'mode_simul');
  const reduced = tv.reduced;
  const v = {
    T, lang, accent, variant, variantName, modeName, reduced,
    langToggle: lang === 'es' ? 'ES · English' : 'EN · Español',
    vGBorder: variant === 'generala' ? C.generala : C.card, vYBorder: variant === 'yahtzee' ? C.yahtzee : C.card,
    vGCheck: variant === 'generala' ? 1 : 0, vYCheck: variant === 'yahtzee' ? 1 : 0,
    mTurnsBorder: tv.setup.mode === 'turns' ? accent : C.card, mSimulBorder: tv.setup.mode === 'simul' ? accent : C.card,
    narrLabel: tv.setup.narrator ? tt('on') : tt('off'), narrBg: tv.setup.narrator ? C.green : C.sub,
    lenLabel: tv.setup.demoLength === 'short' ? tt('demo_short') : tt('demo_full'),
    rulesShort: I.RULES[variant][lang].slice(0, 5), rules: I.RULES[variant][lang],
    helpTitle: tt('help_title', { variant: variantName }),
  };
  if (!g) return v;

  const players = g.players || [];
  v.nPlayers = Math.max(players.length, 1);
  v.roomCode = g.roomCode;
  v.lobbyPlayers = players.map(p => ({ key: p.id, name: p.name, color: p.color, initial: initial(p.name), connLabel: tt(p.connected ? 'connected' : 'reconnecting'), connColor: p.connected ? C.green : C.focus, border: C.card, empty: false }));
  while (v.lobbyPlayers.length < E.MAX_PLAYERS) v.lobbyPlayers.push({ key: 'empty' + v.lobbyPlayers.length, name: '· · ·', color: C.cardBorder, initial: '', connLabel: '', connColor: 'transparent', border: C.cardBorder, empty: true });
  v.canStart = players.length >= E.MIN_PLAYERS;
  v.lobbyHint = v.canStart ? tt('players_n', { n: players.length }) : (players.length ? tt('need_two') : tt('waiting_players'));
  v.isTurns = g.mode === 'turns'; v.isSimul = g.mode === 'simul';
  const rounds = E.maxRounds(g);
  v.roundLabel = tt('round_of', { n: Math.max(1, Math.min(g.round, rounds)), total: rounds });
  v.muteLabel = tv.muted ? '🔇 ' + tt('unmute') : '🔈 ' + tt('mute');
  v.pauseLabel = g.paused ? tt('resume') : tt('pause');
  v.isPaused = !!g.paused && g.phase === 'playing';
  const dcP = players.find(p => !p.connected);
  v.dcVisible = !!dcP && g.phase === 'playing'; v.dcText = dcP ? tt('player_dc', { name: dcP.name }) : '';

  // Narrator: latest server event that has a line.
  const evs = (g.events || []).slice().sort((a, b) => (a.id || 0) - (b.id || 0));
  let line = null, lineId = null;
  for (let i = evs.length - 1; i >= 0 && !line; i--) { line = feedLine(lang, g, evs[i]); if (line) lineId = evs[i].id; }
  v.feedVisible = !!(g.narrator && !tv.muted && line); v.feedText = line ? line.text : '';
  // spoken by the narrator voice (ui/Voice.js); `id` = the event id, so each line is said once
  v.voiceLine = line && g.narrator ? { id: g.roomCode + ':' + lineId, k: line.k, v: line.v, vars: line.vars, text: line.text, lang } : null;

  const rollsLabel = h => h.rollsLeft === 0 ? tt('no_rolls') : h.rollsLeft === 1 ? tt('rolls_left_one') : tt('rolls_left', { n: h.rollsLeft });
  const statusOf = h => h.done ? tt('ready') : (h.rolled && h.rollsLeft === 0) ? tt('choosing') : h.rolled ? tt('rolling') : tt('waiting_roll');
  const dieVM = (val, held, h, color, i) => ({ key: i, v: val, held, ring: held ? color : null, rollKey: h.rolled ? (h.rollId || 0) : 0 });
  const cats = E.VARIANTS[g.variant].cats;

  if (g.mode === 'turns' && g.phase === 'playing' && players.length) {
    const ap = players[g.activeIdx] || players[0]; const h = g.hand;
    v.active = { color: ap.color, initial: initial(ap.name) };
    const shaking = shakingNow(h, tv.now || Date.now(), ap.id);
    v.shaking = shaking;
    v.turnLabel = tt('turn_of', { name: ap.name }); v.rollsLabel = rollsLabel(h);
    v.statusLabel = shaking ? (I.STR[lang] && I.STR[lang].shaking) || TV_STR[lang].shaking : statusOf(h);
    // Input for the 3D dice view (protocol in docs/ARCHITECTURE.md). rollKey identifies one roll: hand.rollId
    // restarts with every fresh hand, so it is combined with the round and the active seat.
    v.dice3d = {
      dice: h.dice.slice(), held: h.dice.map((_, i) => !!(h.held[i] && h.rolled)), rolled: !!h.rolled,
      rollKey: g.round + ':' + g.activeIdx + ':' + (h.rollId || 0), shaking, color: ap.color, reduced,
    };
    v.rollDots = [0, 1, 2].map(i => i < h.rollsLeft ? ap.color : C.chip);
    v.dice = h.dice.map((d, i) => dieVM(d, !!(h.held[i] && h.rolled), h, ap.color, i));
    // While the 3D dice are still landing, keep the result to themselves (no potentials, no "First roll").
    const landing = !!(tv.dice3d && h.rolled) && landingNow(v.dice3d.rollKey, tv.landedKey, tv.now || Date.now());
    v.landing = landing;
    v.servidaVisible = g.variant === 'generala' && h.rolled && h.rollsLeft === 2 && !landing;
    const pot = landing ? null : E.handPotential(g, ap.id);
    v.cols = players.map(p => ({ key: p.id, name: p.name, color: p.color, initial: initial(p.name), ring: p.id === ap.id ? C.inkDark : null }));
    const size = g.variant === 'yahtzee' ? 17 : 19;
    const row = (key, label, cells, o = {}) => ({ key, label, cells, size: o.size || size, weight: o.weight || '700', labelColor: o.labelColor || C.pip, bg: o.bg || 'transparent' });
    const cellFor = (p, c) => {
      const val = p.sheet[c];
      if (val !== undefined) return { text: String(val), color: val === 0 ? C.muted : C.inkDark, weight: '800' };
      if (p.id === ap.id && pot) { const s = pot.scores[c]; if (s === null || s === undefined) return { text: '—', color: '#C9B99F', weight: '600' }; return { text: String(s), color: accent, weight: '700' }; }
      return { text: '', color: C.inkDark, weight: '600' };
    };
    const rows = cats.map(c => row(c, catName(lang, g.variant, c), players.map(p => cellFor(p, c)), { bg: pot && pot.forced === c ? '#FFE9A8' : 'transparent' }));
    if (g.variant === 'yahtzee') {
      const tot = players.map(p => E.totals('yahtzee', p));
      rows.splice(6, 0,
        row('upperSum', tt('upper_sum'), tot.map(x => ({ text: String(x.upper), color: '#6E6052', weight: '700' })), { labelColor: '#6E6052', size: 14 }),
        row('upperBonus', tt('upper_bonus'), tot.map(x => ({ text: x.upperBonus ? '+35' : '·', color: x.upperBonus ? '#2A9D8F' : '#C9B99F', weight: '800' })), { labelColor: '#6E6052', size: 14 }));
      rows.push(row('yBonus', tt('yahtzee_bonus'), tot.map(x => ({ text: x.yBonus ? '+' + x.yBonus : '·', color: x.yBonus ? '#2A9D8F' : '#C9B99F', weight: '800' })), { labelColor: '#6E6052', size: 14 }));
    }
    rows.push(row('total', tt('total'), players.map(p => ({ text: String(E.totals(g.variant, p).total), color: C.inkDark, weight: '800' })), { weight: '800', size: size + 3, bg: '#F1E6D2' }));
    v.rows = rows;
  }

  if (g.mode === 'simul' && g.phase === 'playing') {
    v.panels = players.map(p => {
      const h = (g.hands && g.hands[p.id]) || { dice: [1, 2, 3, 4, 5], held: [], rollsLeft: 3, rolled: false, done: false };
      const filled = Object.keys(p.sheet).length; const done = h.done;
      const pot = E.handPotential(g, p.id);
      const rows = cats.map(c => {
        const label = catName(lang, g.variant, c); const val = p.sheet[c];
        if (val !== undefined) return { key: c, label, text: String(val), color: val === 0 ? C.faint : C.ink, weight: '800', bg: 'transparent' };
        const s = pot && !done ? pot.scores[c] : undefined;
        if (s === null) return { key: c, label, text: '—', color: '#5A4A42', weight: '600', bg: 'transparent' };
        if (s !== undefined) return { key: c, label, text: String(s), color: s === 0 ? C.faint : C.focus, weight: '700', bg: pot.forced === c ? 'rgba(255,209,102,0.18)' : 'transparent' };
        return { key: c, label, text: '', color: C.muted, weight: '600', bg: 'transparent' };
      });
      return {
        key: p.id, rows, name: p.name, color: p.color, initial: initial(p.name), status: statusOf(h),
        statusBg: done ? C.green : (h.rolled ? C.focus : C.chip), statusFg: done || h.rolled ? C.inkDark : C.ink, opacity: done ? 0.78 : 1,
        dice: h.dice.map((d, i) => dieVM(d, !!(h.held[i] && h.rolled), h, p.color, i)),
        rollsLabel: done ? tt('waiting_rest') : rollsLabel(h), progress: filled + ' / ' + rounds, pct: Math.min(100, Math.round(filled / rounds * 100)), total: E.totals(g.variant, p).total,
      };
    });
  }

  if (g.phase === 'results') {
    const ranked = players.map(p => ({ p, total: E.totals(g.variant, p).total })).sort((a, b) => b.total - a.total);
    const wids = g.winnerIds || [];
    const winners = players.filter(p => wids.includes(p.id));
    v.ranking = ranked.map((x, i) => { const w = wids.includes(x.p.id); return { key: x.p.id, rank: i + 1, name: x.p.name, color: x.p.color, initial: initial(x.p.name), total: x.total, bg: w ? C.ink : C.card, fg: w ? C.inkDark : C.ink, scale: w ? 1.04 : 1 }; });
    v.winnerLabel = g.endReason === 'servida' && winners[0] ? tt('servida_win', { name: winners[0].name })
      : g.endReason === 'tie' ? tt('tie', { names: winners.map(w => w.name).join(' · ') })
      : tt('winner', { name: winners[0] ? winners[0].name : '' });
    v.playedLabel = tt('played_variant', { variant: variantName, mode: modeName });
  }
  return v;
}
