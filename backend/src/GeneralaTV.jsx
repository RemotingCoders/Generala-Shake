import React from 'react';
import qrcode from 'qrcode-generator';
import Dice3D from './Dice3D.jsx';

const PIPS = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };
const RING = '0 0 0 6px #FFD166, 0 0 0 12px rgba(255,209,102,.3)';
const FOCUS_IDS = ['endGame','vG','vY','continue','help','lang','mTurns','mSimul','narr','len','create','back','start','leave','mute','pause','rematch','changeVariant','home','closeHelp'];

const fredoka = "'Fredoka',sans-serif";
const dieFace = 'linear-gradient(145deg,#FFF9EE,#EAD9BE)';
const eyebrow = { fontSize: 20, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B9A48C' };
const ghostBtn = { background: 'transparent', color: '#FFF3DF', border: '3px solid #5A4A42', borderRadius: 999, padding: '17px 30px', fontSize: 24, fontWeight: 700 };
const pillBtn = { background: '#2B2320', color: '#FFF3DF', border: '3px solid #3C312C', borderRadius: 999, padding: '8px 18px', fontSize: 19, fontWeight: 700 };
const screenBase = { position: 'absolute', inset: 0, boxSizing: 'border-box' };

// Real QR of the join URL, drawn as SVG modules
const qrCache = {};
function qr(text){
  if (qrCache[text]) return qrCache[text];
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const N = q.getModuleCount(), cells = [];
  for (let y=0;y<N;y++) for (let x=0;x<N;x++) if (q.isDark(y, x)) cells.push(<rect key={x+'-'+y} x={x} y={y} width={1.02} height={1.02} />);
  const el = <svg width={300} height={300} viewBox={`0 0 ${N} ${N}`} fill="#1E1715" shapeRendering="crispEdges" style={{ display: 'block' }} role="img" aria-label={text}>{cells}</svg>;
  qrCache[text] = el; return el;
}

function dieVM(v, held, rolled, rollId, color, reduced, lift, shaking){
  const pips = [0,1,2,3,4,5,6,7,8].map(i => PIPS[v].includes(i) ? 1 : 0);
  const anim = (shaking && !held && !reduced) ? 'tumbleLoopA .6s linear infinite' : (!rolled || held || reduced) ? 'none' : ((rollId % 2 ? 'tumbleA' : 'tumbleB') + ' .55s ease-out');
  return { v, pips, held, ring: held ? color : 'transparent', lift: held ? -lift : 0, anim, tagColor: color, tagOp: held ? 1 : 0 };
}

let confettiEl = null;
function confetti(reduced){
  if (reduced) return null;
  if (confettiEl) return confettiEl;
  const colors = ['#E8603C','#2A9D8F','#E9B44C','#7B6CF6','#FFF3DF'];
  const items = Array.from({ length: 28 }, (_, i) => <i key={i} style={{ position: 'absolute', left: (i * 37 % 100) + '%', top: -30, width: 10 + (i % 3) * 4, height: 14 + (i % 4) * 4, borderRadius: 3, background: colors[i % colors.length], animation: `fall ${5 + (i % 5) * .8}s linear ${(i % 7) * .4}s infinite`, opacity: .9 }} />);
  confettiEl = <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>{items}</div>;
  return confettiEl;
}

function Pips({ pips, size }){
  return pips.map((p, i) => <i key={i} style={{ width: size, height: size, borderRadius: '50%', background: '#2A211C', opacity: p }} />);
}

function Narrator({ T, text, anim }){
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#FFF3DF', color: '#1E1715', borderRadius: 20, padding: '14px 20px', animation: anim }}>
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8A7A6A', whiteSpace: 'nowrap', marginTop: 5 }}>{T.narrator_tag}</span>
      <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, textWrap: 'pretty' }}>{text}</span>
    </div>
  );
}

function computeVals(P){
  const { game: g, tv, t, cat, act, screen, focusId, E } = P;
  const lang = tv.lang;
  const T = { ...P.I.STR[lang], hold_tag: lang === 'es' ? 'Se queda' : 'Kept' };
  const on = {}, fs = {}; FOCUS_IDS.forEach(id => { on[id] = () => act(id); fs[id] = focusId === id ? RING : 'none'; });
  const variant = g ? g.variant : tv.setup.variant;
  const accent = variant === 'generala' ? '#E8603C' : '#5B8DEF';
  const variantName = t(variant === 'generala' ? 'v_generala' : 'v_yahtzee');
  const mode = g ? g.mode : tv.setup.mode;
  const modeName = t(mode === 'turns' ? 'mode_turns' : 'mode_simul');
  const langToggle = lang === 'es' ? 'ES · English' : 'EN · Español';
  const reduced = tv.reduced;
  const popAnim = reduced ? 'none' : 'popIn .35s ease-out';
  const pulseAnim = reduced ? 'none' : 'pulse 1.2s ease-in-out infinite';
  const vals = {
    T, on, fs, accent, variantName, modeName, langToggle, popAnim, pulseAnim,
    isHome: screen === 'home', isSetup: screen === 'setup', isLobby: screen === 'lobby', isPlaying: screen === 'playing' || screen === 'paused', isResults: screen === 'results', isClosed: screen === 'closed', isHelp: screen === 'help',
    vGBorder: variant === 'generala' ? '#E8603C' : '#2B2320', vYBorder: variant === 'yahtzee' ? '#5B8DEF' : '#2B2320', vGCheck: variant === 'generala' ? 1 : 0, vYCheck: variant === 'yahtzee' ? 1 : 0,
    mTurnsBorder: mode === 'turns' ? accent : '#2B2320', mSimulBorder: mode === 'simul' ? accent : '#2B2320',
    narrLabel: tv.setup.narrator ? t('on') : t('off'), narrBg: tv.setup.narrator ? '#9BD69B' : '#D9C7B0',
    lenLabel: tv.setup.demoLength === 'short' ? t('demo_short') : t('demo_full'),
    rulesShort: P.I.RULES[variant][lang].slice(0, 5), rules: P.I.RULES[variant][lang],
    helpTitle: t('help_title', { variant: variantName }),
  };
  if (!g) return vals;
  const players = g.players; const nP = Math.max(players.length, 1);
  const initial = n => (n || '?').trim().charAt(0).toUpperCase();
  vals.roomCode = g.roomCode; vals.qr = qr(P.joinUrl || g.roomCode);
  vals.enterCode = P.joinHost ? t('or_enter_code_url', { url: P.joinHost }) : T.or_enter_code;
  vals.lobbyPlayers = players.map(p => ({ key: p.id, name: p.name, color: p.color, initial: initial(p.name), connLabel: t(p.connected ? 'connected' : 'reconnecting'), connColor: p.connected ? '#9BD69B' : '#FFD166', border: '#2B2320' }));
  while (vals.lobbyPlayers.length < 4) vals.lobbyPlayers.push({ key: 'empty' + vals.lobbyPlayers.length, name: '· · ·', color: '#3C312C', initial: '', connLabel: '', connColor: 'transparent', border: '#3C312C' });
  const canStart = players.length >= E.MIN_PLAYERS;
  vals.lobbyHint = canStart ? t('players_n', { n: players.length }) : (players.length ? t('need_two') : t('waiting_players'));
  vals.waitingAnim = canStart || reduced ? 'none' : 'pulse 1.6s ease-in-out infinite';
  vals.startOpacity = canStart ? 1 : .4;
  vals.nPlayers = nP; vals.isTurns = g.mode === 'turns'; vals.isSimul = g.mode === 'simul';
  vals.roundLabel = t('round_of', { n: Math.min(g.round, E.maxRounds(g)), total: E.maxRounds(g) });
  vals.muteLabel = tv.muted ? '🔇 ' + t('unmute') : '🔈 ' + t('mute');
  vals.pauseLabel = g.paused ? t('resume') : t('pause');
  vals.isPaused = !!g.paused;
  const dcP = players.find(p => !p.connected);
  vals.dcVisible = !!dcP && g.phase === 'playing'; vals.dcText = dcP ? t('player_dc', { name: dcP.name }) : '';
  const lastEv = [...tv.feed].reverse().map(ev => P.feedText(ev)).find(Boolean);
  vals.feedVisible = !!(g.narrator && !tv.muted && lastEv); vals.feedText = lastEv || '';
  const rollsLabel = h => h.rollsLeft === 0 ? t('no_rolls') : h.rollsLeft === 1 ? t('rolls_left_one') : t('rolls_left', { n: h.rollsLeft });
  const now = Date.now();
  const statusOf = h => h.done ? t('ready') : E.isShaking(h, now) ? t('shaking') : (h.rolled && h.rollsLeft === 0) ? t('choosing') : h.rolled ? t('rolling') : t('waiting_roll');
  const cats = E.VARIANTS[g.variant].cats;
  if (g.mode === 'turns' && g.phase === 'playing') {
    const ap = players[g.activeIdx] || players[0]; const h = g.hand;
    vals.active = { color: ap.color, initial: initial(ap.name) };
    vals.turnLabel = t('turn_of', { name: ap.name }); vals.statusLabel = statusOf(h); vals.rollsLabel = rollsLabel(h);
    vals.rollDots = [0,1,2].map(i => i < h.rollsLeft ? ap.color : '#4A3B35');
    const shaking = E.isShaking(h, now);
    vals.shaking = shaking; vals.statusColor = shaking ? '#FFD166' : '#D9C7B0'; vals.statusAnim = shaking ? pulseAnim : 'none';
    vals.dice = h.dice.map((v, i) => dieVM(v, h.held[i] && h.rolled, h.rolled, h.rollId || 0, ap.color, reduced, 14, shaking));
    // 3D view input (docs/ARCHITECTURE.md); rollKey → int rollId inside Dice3D
    vals.dice3d = { dice: h.dice, held: h.held.map(x => !!x && h.rolled), rolled: h.rolled, rollKey: [g.round, g.activeIdx, h.rollId || 0].join('|'), shaking, color: ap.color, reduced: !!reduced };
    vals.servidaVisible = g.variant === 'generala' && h.rolled && h.rollsLeft === 2 && !tv.settling;
    const pot = E.handPotential(g, ap.id);
    vals.cols = players.map(p => ({ key: p.id, name: p.name, color: p.color, initial: initial(p.name), ring: p.id === ap.id ? '#1E1715' : 'transparent' }));
    const size = g.variant === 'yahtzee' ? 17 : 19;
    const row = (key, label, cells, opts = {}) => ({ key, label, cells, size: opts.size || size, weight: opts.weight || 700, labelColor: opts.labelColor || '#2A211C', bg: opts.bg || 'transparent' });
    const cellFor = (p, c) => {
      const v = p.sheet[c];
      if (v !== undefined) return { text: String(v), color: v === 0 ? '#B9A48C' : '#1E1715', weight: 800 };
      if (p.id === ap.id && pot && tv.settling) return { text: '…', color: '#C9B99F', weight: 600 }; // 3D dice still landing
      if (p.id === ap.id && pot) { const s = pot.scores[c]; if (s === null) return { text: '—', color: '#C9B99F', weight: 600 }; return { text: String(s), color: accent, weight: 700 }; }
      return { text: '', color: '#1E1715', weight: 600 };
    };
    const rows = cats.map(c => row(c, cat(g.variant, c), players.map(p => cellFor(p, c)), { bg: pot && pot.forced === c ? '#FFE9A8' : 'transparent' }));
    if (g.variant === 'yahtzee') {
      const tot = players.map(p => E.totals('yahtzee', p));
      rows.splice(6, 0, row('upperSum', t('upper_sum'), tot.map(x => ({ text: String(x.upper), color: '#6E6052', weight: 700 })), { labelColor: '#6E6052', size: 14 }), row('upperBonus', t('upper_bonus'), tot.map(x => ({ text: x.upperBonus ? '+35' : '·', color: x.upperBonus ? '#2A9D8F' : '#C9B99F', weight: 800 })), { labelColor: '#6E6052', size: 14 }));
      rows.push(row('yBonus', t('yahtzee_bonus'), tot.map(x => ({ text: x.yBonus ? '+' + x.yBonus : '·', color: x.yBonus ? '#2A9D8F' : '#C9B99F', weight: 800 })), { labelColor: '#6E6052', size: 14 }));
    }
    rows.push(row('total', t('total'), players.map(p => ({ text: String(E.totals(g.variant, p).total), color: '#1E1715', weight: 800 })), { weight: 800, size: size + 3, bg: '#F1E6D2' }));
    vals.rows = rows;
  }
  if (g.mode === 'simul' && g.phase === 'playing') {
    const rounds = E.maxRounds(g);
    vals.panels = players.map(p => {
      const h = g.hands[p.id]; const filled = Object.keys(p.sheet).length;
      const done = h.done;
      const pot = E.handPotential(g, p.id);
      const rows = cats.map(c => { const label = cat(g.variant, c); const v = p.sheet[c]; if (v !== undefined) return { key: c, label, text: String(v), color: v === 0 ? '#8F7D6A' : '#FFF3DF', weight: 800, bg: 'transparent' }; const s = pot && !done ? pot.scores[c] : undefined; if (s === null) return { key: c, label, text: '—', color: '#5A4A42', weight: 600, bg: 'transparent' }; if (s !== undefined) return { key: c, label, text: String(s), color: s === 0 ? '#8F7D6A' : '#FFD166', weight: 700, bg: pot.forced === c ? 'rgba(255,209,102,.18)' : 'transparent' }; return { key: c, label, text: '', color: '#B9A48C', weight: 600, bg: 'transparent' }; });
      return { key: p.id, rows, name: p.name, color: p.color, initial: initial(p.name), status: statusOf(h), statusBg: done ? '#9BD69B' : (h.rolled ? '#FFD166' : '#4A3B35'), statusFg: done || h.rolled ? '#1E1715' : '#FFF3DF', opacity: done ? .78 : 1,
        dice: h.dice.map((v, i) => dieVM(v, h.held[i] && h.rolled, h.rolled, h.rollId || 0, p.color, reduced, 6, E.isShaking(h, now))), rollsLabel: done ? t('waiting_rest') : rollsLabel(h), progress: filled + ' / ' + rounds, pct: Math.round(filled / rounds * 100), total: E.totals(g.variant, p).total };
    });
  }
  if (g.phase === 'results') {
    const ranked = players.map(p => ({ p, total: E.totals(g.variant, p).total })).sort((a, b) => b.total - a.total);
    const winners = players.filter(p => g.winnerIds.includes(p.id));
    vals.ranking = ranked.map((x, i) => { const w = g.winnerIds.includes(x.p.id); return { key: x.p.id, rank: i + 1, name: x.p.name, color: x.p.color, initial: initial(x.p.name), total: x.total, bg: w ? '#FFF3DF' : '#2B2320', fg: w ? '#1E1715' : '#FFF3DF', scale: w ? 1.04 : 1 }; });
    vals.winnerLabel = g.endReason === 'servida' ? t('servida_win', { name: winners[0].name }) : g.endReason === 'tie' ? t('tie', { names: winners.map(w => w.name).join(' · ') }) : t('winner', { name: winners[0] ? winners[0].name : '' });
    vals.playedLabel = t('played_variant', { variant: variantName, mode: modeName });
    vals.confetti = confetti(reduced);
  }
  return vals;
}

export default function GeneralaTV({ tv }){
  if (!tv || !tv.tv) return null;
  const v = computeVals(tv);
  const { T, on, fs, accent } = v;
  const accentBtn = { background: accent, color: '#1E1715', border: 'none', borderRadius: 999, padding: '20px 44px', fontSize: 28, fontWeight: 800 };
  const sheetCols = `1fr repeat(${v.nPlayers}, 86px)`;

  return (
    <div data-screen-label="TV" style={{ width: 1280, height: 720, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 20% 0%, #3A2A24 0%, #1E1715 55%, #171210 100%)', color: '#FFF3DF', fontFamily: "'Nunito',system-ui,sans-serif", fontSize: 24, boxSizing: 'border-box' }}>

      {v.isHome && (
        <div data-screen-label="TV · Inicio" style={{ ...screenBase, padding: '56px 72px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 92, lineHeight: .95, letterSpacing: '-.03em' }}>Generala</div>
              <div style={{ marginTop: 14, fontSize: 26, color: '#D9C7B0', fontWeight: 600 }}>{T.tagline}</div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
              <div style={{ width: 84, height: 84, borderRadius: 22, background: dieFace, boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.08),0 14px 24px -10px rgba(0,0,0,.6)', transform: 'rotate(-10deg)', display: 'grid', placeItems: 'center', gridTemplateColumns: 'repeat(3,1fr)', padding: 14, boxSizing: 'border-box' }}>
                {['1/1','2/2','3/3'].map(a => <i key={a} style={{ gridArea: a, width: 14, height: 14, borderRadius: '50%', background: '#2A211C' }} />)}
              </div>
              <div style={{ width: 84, height: 84, borderRadius: 22, background: dieFace, boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.08),0 14px 24px -10px rgba(0,0,0,.6)', transform: 'rotate(8deg) translateY(10px)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', placeItems: 'center', padding: 14, boxSizing: 'border-box' }}>
                {['1/1','1/3','2/2','3/1','3/3'].map(a => <i key={a} style={{ gridArea: a, width: 14, height: 14, borderRadius: '50%', background: '#E8603C' }} />)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 44, fontSize: 22, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B9A48C' }}>{T.home_pick}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 16 }}>
            {[{ id: 'vG', name: 'Generala', dot: '#E8603C', border: v.vGBorder, check: v.vGCheck, desc: T.v_generala_desc }, { id: 'vY', name: 'Yahtzee', dot: '#5B8DEF', border: v.vYBorder, check: v.vYCheck, desc: T.v_yahtzee_desc }].map(o => (
              <button key={o.id} onClick={on[o.id]} style={{ textAlign: 'left', background: '#2B2320', border: `4px solid ${o.border}`, borderRadius: 28, padding: '30px 34px', color: '#FFF3DF', boxShadow: fs[o.id], transition: 'box-shadow .15s,border-color .15s', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ width: 18, height: 18, borderRadius: '50%', background: o.dot, flex: 'none' }} /><span style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 40 }}>{o.name}</span><span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 800, color: o.dot, opacity: o.check }}>✓</span></div>
                <div style={{ fontSize: 24, lineHeight: 1.4, color: '#E7D8C3', textWrap: 'pretty' }}>{o.desc}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
            <button onClick={on.continue} style={{ ...accentBtn, boxShadow: fs.continue }}>{T.continue} →</button>
            <button onClick={on.help} style={{ ...ghostBtn, boxShadow: fs.help }}>{T.how_to_play}</button>
            <button onClick={on.lang} style={{ ...ghostBtn, marginLeft: 'auto', padding: '14px 24px', fontSize: 22, boxShadow: fs.lang, display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ opacity: .55 }}>🌐</span>{v.langToggle}</button>
          </div>
          <div style={{ marginTop: 18, fontSize: 18, color: '#8F7D6A' }}>{T.remote_hint}</div>
        </div>
      )}

      {v.isSetup && (
        <div data-screen-label="TV · Configuración" style={{ ...screenBase, padding: '48px 72px', display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 44 }}>{T.setup_title}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: accent, color: '#1E1715', borderRadius: 999, padding: '10px 22px', fontWeight: 800, fontSize: 22 }}>{T.rules_variant}: {v.variantName}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 36, flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={eyebrow}>{T.mode_label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <button onClick={on.mTurns} style={{ textAlign: 'left', background: '#2B2320', border: `4px solid ${v.mTurnsBorder}`, borderRadius: 22, padding: '22px 24px', color: '#FFF3DF', boxShadow: fs.mTurns, display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 28, fontWeight: 800 }}>{T.mode_turns}</span><span style={{ fontSize: 20, color: '#D9C7B0', lineHeight: 1.35 }}>{T.mode_turns_desc}</span></button>
                <button onClick={on.mSimul} style={{ textAlign: 'left', background: '#2B2320', border: `4px solid ${v.mSimulBorder}`, borderRadius: 22, padding: '22px 24px', color: '#FFF3DF', boxShadow: fs.mSimul, display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 28, fontWeight: 800, display: 'flex', gap: 10, alignItems: 'center' }}>{T.mode_simul} <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', background: '#4A3B35', padding: '4px 8px', borderRadius: 6 }}>{T.mode_simul_tag}</span></span><span style={{ fontSize: 20, color: '#D9C7B0', lineHeight: 1.35 }}>{T.mode_simul_desc}</span></button>
              </div>
              <button onClick={on.narr} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#2B2320', border: '4px solid #2B2320', borderRadius: 18, padding: '18px 24px', color: '#FFF3DF', boxShadow: fs.narr, textAlign: 'left' }}><span style={{ fontSize: 26, fontWeight: 800 }}>{T.narrator_label}</span><span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, background: v.narrBg, color: '#1E1715', borderRadius: 999, padding: '6px 18px' }}>{v.narrLabel}</span></button>
              <button onClick={on.len} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#2B2320', border: '4px solid #2B2320', borderRadius: 18, padding: '18px 24px', color: '#FFF3DF', boxShadow: fs.len, textAlign: 'left' }}><span style={{ fontSize: 26, fontWeight: 800 }}>{T.demo_len}</span><span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, background: '#D9C7B0', color: '#1E1715', borderRadius: 999, padding: '6px 18px' }}>{v.lenLabel}</span></button>
            </div>
            <div style={{ background: '#2B2320', borderRadius: 22, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}>
              <div style={eyebrow}>{T.rules_summary}</div>
              {v.rulesShort.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, fontSize: 20, lineHeight: 1.35, color: '#E7D8C3' }}><span style={{ color: accent, fontWeight: 800 }}>•</span><span style={{ textWrap: 'pretty' }}>{r}</span></div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <button onClick={on.create} style={{ ...accentBtn, boxShadow: fs.create }}>{T.create_room}</button>
            <button onClick={on.back} style={{ ...ghostBtn, boxShadow: fs.back }}>← {T.back}</button>
          </div>
        </div>
      )}

      {v.isLobby && (
        <div data-screen-label="TV · Sala de espera" style={{ ...screenBase, padding: '44px 72px', display: 'grid', gridTemplateColumns: '440px 1fr', gap: 56 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <div style={{ background: '#FFF9EE', borderRadius: 28, padding: 22, boxShadow: '0 30px 50px -30px rgba(0,0,0,.8)' }}>{v.qr}</div>
            <div style={{ fontSize: 22, color: '#D9C7B0', textAlign: 'center', fontWeight: 700 }}>{T.scan_qr}</div>
            <div style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 72, letterSpacing: '.18em', lineHeight: 1, marginLeft: '.18em' }}>{v.roomCode}</div>
            <div style={{ fontSize: 18, color: '#8F7D6A', textAlign: 'center', textWrap: 'pretty' }}>{v.enterCode}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 44 }}>{T.lobby_title}</div>
              <span style={{ background: accent, color: '#1E1715', borderRadius: 999, padding: '8px 18px', fontWeight: 800, fontSize: 20 }}>{v.variantName}</span>
              <span style={{ background: '#4A3B35', color: '#FFF3DF', borderRadius: 999, padding: '8px 18px', fontWeight: 800, fontSize: 20 }}>{v.modeName}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {v.lobbyPlayers.map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#2B2320', borderRadius: 20, padding: '16px 20px', minHeight: 84, boxSizing: 'border-box', border: `3px solid ${p.border}` }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: p.color, display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 30, color: '#1E1715', flex: 'none' }}>{p.initial}</div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 26, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span><span style={{ fontSize: 17, color: p.connColor, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: p.connColor }} />{p.connLabel}</span></div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 22, color: '#B9A48C', fontWeight: 700, animation: v.waitingAnim }}>{v.lobbyHint}</div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: 18, alignItems: 'center' }}>
              <button onClick={on.start} style={{ ...accentBtn, padding: '18px 32px', fontSize: 26, whiteSpace: 'nowrap', boxShadow: fs.start, opacity: v.startOpacity }}>▶ {T.start_game}</button>
              <button onClick={on.leave} style={{ ...ghostBtn, padding: '15px 24px', fontSize: 22, whiteSpace: 'nowrap', boxShadow: fs.leave }}>{T.leave_room}</button>
              <button onClick={on.lang} style={{ ...ghostBtn, marginLeft: 'auto', padding: '14px 20px', fontSize: 20, whiteSpace: 'nowrap', boxShadow: fs.lang }}>{v.langToggle}</button>
            </div>
          </div>
        </div>
      )}

      {v.isPlaying && (
        <div data-screen-label="TV · Partida" style={{ ...screenBase, padding: '28px 44px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 30, letterSpacing: '-.02em' }}>Generala</span>
            <span style={{ background: accent, color: '#1E1715', borderRadius: 999, padding: '5px 14px', fontWeight: 800, fontSize: 18 }}>{v.variantName}</span>
            <span style={{ background: '#4A3B35', borderRadius: 999, padding: '5px 14px', fontWeight: 800, fontSize: 18 }}>{v.modeName}</span>
            <span style={{ marginLeft: 12, fontSize: 22, fontWeight: 800, color: '#D9C7B0' }}>{v.roundLabel}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button onClick={on.help} style={{ ...pillBtn, boxShadow: fs.help }}>? {T.how_to_play}</button>
              <button onClick={on.mute} style={{ ...pillBtn, boxShadow: fs.mute }}>{v.muteLabel}</button>
              <button onClick={on.pause} style={{ ...pillBtn, boxShadow: fs.pause }}>{v.pauseLabel}</button>
              <button onClick={on.lang} style={{ ...pillBtn, boxShadow: fs.lang }}>{v.langToggle}</button>
            </div>
          </div>

          {v.isTurns && v.active && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 520px', gap: 28, flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#2B2320', borderRadius: 24, padding: '18px 24px', borderLeft: `14px solid ${v.active.color}` }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', background: v.active.color, display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 36, color: '#1E1715' }}>{v.active.initial}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.turnLabel}</span><span data-status={v.shaking ? 'shaking' : ''} style={{ fontSize: 20, color: v.statusColor, fontWeight: 700, animation: v.statusAnim }}>{v.shaking ? '🎲 ' : ''}{v.statusLabel}</span></div>
                  <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}><span style={{ fontSize: 20, fontWeight: 800, color: '#D9C7B0' }}>{v.rollsLabel}</span><div style={{ display: 'flex', gap: 8 }}>{v.rollDots.map((d, i) => <i key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: d }} />)}</div></div>
                </div>
                <div style={{ flex: 1, background: '#24201B', borderRadius: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 18, position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(ellipse at 50% 120%, #3A2F28 0%, transparent 60%)' }}>
                  <div style={{ alignSelf: 'stretch', flex: 1, minHeight: 0 }}>
                    <Dice3D msg={v.dice3d} onStatus={tv.onDice3d} fallback={(
                  <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', height: 150 }}>
                    {v.dice.map((d, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transform: `translateY(${d.lift}px)`, transition: 'transform .2s' }}>
                        <div key={d.anim === 'none' ? 'still' : d.anim} style={{ width: 104, height: 104, borderRadius: 24, background: dieFace, boxShadow: `inset 0 -7px 0 rgba(0,0,0,.08),0 18px 28px -12px rgba(0,0,0,.7),0 0 0 5px ${d.ring}`, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: 16, boxSizing: 'border-box', placeItems: 'center', animation: d.anim }}>
                          <Pips pips={d.pips} size={17} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: d.tagColor, opacity: d.tagOp }}>✓ {T.hold_tag}</span>
                      </div>
                    ))}
                  </div>
                    )} />
                  </div>
                  <div style={{ fontSize: 19, color: '#8F7D6A', fontWeight: 700 }}>{T.hold_hint}</div>
                  {v.servidaVisible && <div style={{ position: 'absolute', top: 18, right: 22, background: '#FFD166', color: '#1E1715', borderRadius: 999, padding: '6px 16px', fontWeight: 800, fontSize: 18 }}>{T.served}</div>}
                </div>
                {v.feedVisible && <Narrator key={v.feedText} T={T} text={v.feedText} anim={v.popAnim} />}
              </div>
              <div style={{ background: '#FFF9EE', color: '#1E1715', borderRadius: 24, padding: '14px 18px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: sheetCols, gap: 4, alignItems: 'center', paddingBottom: 8, borderBottom: '2px solid #E3D6C0' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8A7A6A' }}>{v.variantName}</span>
                  {v.cols.map(c => <div key={c.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><span style={{ width: 34, height: 34, borderRadius: '50%', background: c.color, display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 19, boxShadow: `0 0 0 3px ${c.ring}` }}>{c.initial}</span><span style={{ fontSize: 13, fontWeight: 800, maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span></div>)}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', minHeight: 0 }}>
                  {v.rows.map(r => (
                    <div key={r.key} style={{ display: 'grid', gridTemplateColumns: sheetCols, gap: 4, alignItems: 'center', background: r.bg, borderRadius: 8, padding: '2px 6px' }}>
                      <span style={{ fontSize: r.size, fontWeight: r.weight, color: r.labelColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                      {r.cells.map((c, i) => <span key={i} style={{ textAlign: 'center', fontSize: r.size, fontWeight: c.weight, color: c.color, fontVariantNumeric: 'tabular-nums' }}>{c.text}</span>)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {v.isSimul && v.panels && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${v.nPlayers}, minmax(0,1fr))`, gap: 18, flex: 1, minHeight: 0 }}>
                {v.panels.map(p => (
                  <div key={p.key} style={{ background: '#2B2320', borderRadius: 24, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: `10px solid ${p.color}`, minWidth: 0, opacity: p.opacity }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ width: 48, height: 48, borderRadius: '50%', background: p.color, display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 26, color: '#1E1715' }}>{p.initial}</span><span style={{ fontSize: 26, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span><span style={{ marginLeft: 'auto', background: p.statusBg, color: p.statusFg, borderRadius: 999, padding: '5px 14px', fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap' }}>{p.status}</span></div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {p.dice.map((d, i) => <div key={i + (d.anim === 'none' ? 'still' : d.anim)} style={{ width: 52, height: 52, borderRadius: 12, background: dieFace, boxShadow: `0 0 0 3px ${d.ring}`, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: 8, boxSizing: 'border-box', placeItems: 'center', transform: `translateY(${d.lift}px)`, animation: d.anim }}><Pips pips={d.pips} size={8} /></div>)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: '#D9C7B0', fontWeight: 700 }}><span>{p.rollsLabel}</span><span>{p.progress}</span></div>
                    <div style={{ height: 8, borderRadius: 4, background: '#3C312C', overflow: 'hidden' }}><div style={{ height: '100%', width: p.pct + '%', background: p.color, transition: 'width .3s' }} /></div>
                    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 14px', alignContent: 'start', overflow: 'hidden' }}>
                      {p.rows.map(r => <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 15, lineHeight: 1.3, color: r.color, fontWeight: r.weight, background: r.bg, borderRadius: 6, padding: '1px 6px' }}><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.text}</span></div>)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: '2px solid #3C312C', paddingTop: 8 }}><span style={{ fontSize: 18, color: '#B9A48C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>{T.total}</span><span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 44 }}>{p.total}</span></div>
                  </div>
                ))}
              </div>
              {v.feedVisible && <Narrator key={v.feedText} T={T} text={v.feedText} anim={v.popAnim} />}
            </div>
          )}

          {v.dcVisible && (
            <div style={{ position: 'absolute', left: '50%', top: 84, transform: 'translateX(-50%)', background: '#FFD166', color: '#1E1715', borderRadius: 999, padding: '12px 26px', fontWeight: 800, fontSize: 21, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 20px 40px -20px rgba(0,0,0,.8)' }}><i style={{ width: 14, height: 14, borderRadius: '50%', background: '#1E1715', animation: v.pulseAnim }} />{v.dcText}</div>
          )}
          {v.isPaused && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(23,18,16,.86)', display: 'grid', placeItems: 'center' }}>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                <div style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 64 }}>⏸ {T.paused}</div>
                <div style={{ fontSize: 24, color: '#D9C7B0', maxWidth: 640, textWrap: 'pretty' }}>{T.paused_desc}</div>
                <button onClick={on.pause} style={{ marginTop: 10, background: accent, color: '#1E1715', border: 'none', borderRadius: 999, padding: '18px 40px', fontSize: 26, fontWeight: 800, boxShadow: fs.pause }}>▶ {T.resume}</button>
                <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                  <button onClick={on.endGame} style={{ ...ghostBtn, padding: '14px 26px', fontSize: 22, boxShadow: fs.endGame }}>{T.end_game}</button>
                  <button onClick={on.home} style={{ ...ghostBtn, padding: '14px 26px', fontSize: 22, boxShadow: fs.home }}>{T.go_home}</button>
                </div>
                <div style={{ fontSize: 18, color: '#8F7D6A' }}>{T.end_game_desc}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {v.isResults && v.ranking && (
        <div data-screen-label="TV · Resultados" style={{ ...screenBase, padding: '48px 72px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, overflow: 'hidden' }}>
          {v.confetti}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center', position: 'relative' }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B9A48C' }}>{T.results_title}</div>
            <div style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 64, lineHeight: 1.05, textWrap: 'pretty', animation: v.popAnim }}>{v.winnerLabel}</div>
            <div style={{ fontSize: 22, color: '#D9C7B0', fontWeight: 700 }}>{v.playedLabel}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              <button onClick={on.rematch} style={{ background: accent, color: '#1E1715', border: 'none', borderRadius: 999, padding: '18px 36px', fontSize: 26, fontWeight: 800, boxShadow: fs.rematch, textAlign: 'left' }}>↻ {T.rematch}</button>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={on.changeVariant} style={{ ...ghostBtn, padding: '15px 26px', fontSize: 22, boxShadow: fs.changeVariant }}>{T.change_variant}</button>
                <button onClick={on.home} style={{ ...ghostBtn, padding: '15px 26px', fontSize: 22, boxShadow: fs.home }}>{T.go_home}</button>
                <button onClick={on.lang} style={{ ...ghostBtn, padding: '15px 26px', fontSize: 22, boxShadow: fs.lang }}>{v.langToggle}</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center', position: 'relative' }}>
            {v.ranking.map(p => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 18, background: p.bg, color: p.fg, borderRadius: 22, padding: '18px 24px', transform: `scale(${p.scale})`, transformOrigin: 'left center' }}>
                <span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 34, width: 44, opacity: .6 }}>{p.rank}</span>
                <span style={{ width: 56, height: 56, borderRadius: '50%', background: p.color, display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 30, color: '#1E1715' }}>{p.initial}</span>
                <span style={{ fontSize: 30, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ marginLeft: 'auto', fontFamily: fredoka, fontWeight: 700, fontSize: 44, fontVariantNumeric: 'tabular-nums' }}>{p.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {v.isClosed && (
        <div data-screen-label="TV · Sala cerrada" style={{ ...screenBase, display: 'grid', placeItems: 'center', padding: 72 }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 760 }}>
            <div style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 64 }}>{T.room_closed}</div>
            <div style={{ fontSize: 26, color: '#D9C7B0', textWrap: 'pretty' }}>{T.room_closed_desc}</div>
            <button onClick={on.home} style={{ marginTop: 12, background: accent, color: '#1E1715', border: 'none', borderRadius: 999, padding: '18px 40px', fontSize: 26, fontWeight: 800, boxShadow: fs.home }}>{T.go_home}</button>
          </div>
        </div>
      )}

      {v.isHelp && (
        <div data-screen-label="TV · Cómo jugar" style={{ ...screenBase, background: 'rgba(23,18,16,.94)', padding: '48px 72px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}><div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 44 }}>{v.helpTitle}</div><button onClick={on.closeHelp} style={{ marginLeft: 'auto', background: accent, color: '#1E1715', border: 'none', borderRadius: 999, padding: '14px 30px', fontSize: 24, fontWeight: 800, boxShadow: fs.closeHelp }}>{T.close}</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 36px', alignContent: 'start' }}>
            {v.rules.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, fontSize: 22, lineHeight: 1.4, color: '#E7D8C3' }}><span style={{ fontFamily: fredoka, color: accent, fontWeight: 700, fontSize: 26, width: 30, flex: 'none' }}>{i + 1}</span><span style={{ textWrap: 'pretty' }}>{r}</span></div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', fontSize: 18, color: '#8F7D6A' }}>{T.remote_hint}</div>
        </div>
      )}
    </div>
  );
}
