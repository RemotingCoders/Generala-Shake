import React from 'react';

const PIPS = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };
const fredoka = "'Fredoka',sans-serif";
const dieFace = 'linear-gradient(145deg,#FFF9EE,#EAD9BE)';
const label = { fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8A7A6A' };
const darkBtn = { background: '#1E1715', color: '#FFF3DF', border: 'none', borderRadius: 16, padding: 16, fontSize: 17, fontWeight: 800, minHeight: 56 };
const outlineBtn = { background: 'transparent', color: '#1E1715', border: '2px solid #D9C7B0', borderRadius: 16, padding: 12, fontSize: 16, fontWeight: 800, minHeight: 48 };
const centered = { padding: '16px 18px calc(24px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, alignItems: 'center', textAlign: 'center' };
const listRow = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fff', border: '1px solid #E3D6C0', borderRadius: 12 };
const smallAvatar = { width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 17 };
const scoreCard = { width: '100%', background: '#fff', border: '1px solid #E3D6C0', borderRadius: 16, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', boxSizing: 'border-box' };
const errorBox = { background: '#FBE3DA', border: '2px solid #E8603C', borderRadius: 14, padding: '12px 14px', fontWeight: 800, fontSize: 15 };

function computeVals(ph){
  const { game: g, t, cat, act, E } = ph; const lang = ph.lang;
  const T = ph.I.STR[lang];
  const me = g && g.players.find(p => p.id === ph.id);
  const variant = g ? g.variant : 'generala';
  const accent = variant === 'generala' ? '#E8603C' : '#5B8DEF';
  const variantName = t(variant === 'generala' ? 'v_generala' : 'v_yahtzee');
  const modeName = g ? t(g.mode === 'turns' ? 'mode_turns' : 'mode_simul') : '';
  const reduced = ph.reduced;
  const initial = n => (n || '?').trim().charAt(0).toUpperCase();
  let screen;
  if (ph.offline) screen = 'reconnecting';
  else if (ph.code && !g && !ph.error) screen = 'loading';
  else if (ph.error && !me) screen = 'error';
  else if (!g || g.closed) screen = (me && g && g.closed) ? 'error' : 'scan';
  else if (!me) screen = (g.phase === 'lobby' && !ph.manualMode) ? 'join' : 'scan';
  else if (g.phase === 'lobby') screen = ph.motionDone ? 'wait' : 'motion';
  else if (g.phase === 'playing') {
    if (g.paused) screen = 'paused';
    else if (g.mode === 'turns') screen = g.players[g.activeIdx].id === me.id ? 'turn' : 'waitTurn';
    else screen = g.hands[me.id].done ? 'doneRound' : 'turn';
  } else screen = 'results';
  const s = {}; s[screen] = true;
  const errKey = ph.error || (me && g && g.closed ? 'closed' : null);
  const errMap = { notfound: 'err_notfound', full: 'err_full', expired: 'err_expired', closed: 'err_closed', started: 'err_started' };
  const on = {
    lang: () => act('lang'), code: e => act('code', e.target.value), name: e => act('name', e.target.value), find: () => act('find'), manual: () => act('manual'), join: () => act('join'), clearError: () => act('clearError'),
    motionAllow: () => act('motionAllow'), motionSkip: () => act('motionSkip'), rules: () => act('rules'), tabDice: () => act('tab', 'dice'), tabSheet: () => act('tab', 'sheet'), roll: () => act('roll'), rollDown: e => act('rollDown', e), rollUp: e => act('rollUp', e), rollCancel: e => act('rollCancel', e), rollClick: e => act('rollClick', e), noMenu: e => e.preventDefault(), confirm: () => act('confirm'), confirmZeroYes: () => act('confirm', true), cancelZero: () => act('cancelZero'), reconnect: () => act('reconnect'),
  };
  const vals = { T, s, on, accent, variantName, modeName, hasGame: !!g && !g.closed, langToggle: lang === 'es' ? 'ES · EN' : 'EN · ES', codeDraft: ph.codeDraft, nameDraft: ph.nameDraft,
    hasError: !!ph.error, errorText: errKey ? t(errMap[errKey] || 'err_notfound') : '', roomCode: g ? g.roomCode : '', roomLabel: g ? t('room_label', { code: g.roomCode }) : '',
    spinAnim: reduced ? 'none' : 'spin 1s linear infinite', shakeAnim: reduced ? 'none' : 'tumbleA 1.4s ease-in-out infinite', shimmerAnim: reduced ? 'none' : 'shimmer 2s ease-in-out infinite', popAnim: reduced ? 'none' : 'popIn .3s ease-out',
    rulesVisible: !!ph.showRules, rules: ph.rules[variant][lang], helpTitle: t('help_title', { variant: variantName }), confirmZeroVisible: !!ph.confirmZero,
    myTotal: me ? E.totals(variant, me).total : 0 };
  if (g && !me) {
    const taken = g.players.map(p => p.color);
    vals.colors = E.COLORS.map(c => ({ color: c, pick: () => act('color', c), border: ph.color === c ? '#1E1715' : 'transparent', opacity: taken.includes(c) ? .25 : 1, mark: ph.color === c ? '✓' : '' }));
    vals.joinOpacity = (ph.nameDraft || '').trim() && !ph.joining ? 1 : .5;
    vals.joinLabel = ph.joining ? t('processing') : t('join');
  }
  if (!g || !me) return vals;
  vals.me = { name: me.name, color: me.color, initial: initial(me.name) };
  vals.others = g.players.map(p => ({ key: p.id, name: p.name, color: p.color, initial: initial(p.name), connLabel: t(p.connected ? 'connected' : 'reconnecting'), connColor: p.connected ? '#2A9D8F' : '#C98A1B' }));
  vals.motionNote = ph.motion === 'denied' || ph.motion === 'unavailable' || ph.motion === 'granted';
  vals.motionNoteText = ph.motion === 'denied' ? t('motion_denied') : ph.motion === 'unavailable' ? t('motion_unavailable') : t('motion_on');
  vals.roundLabel = g.phase === 'playing' ? t('round_of', { n: Math.min(g.round, E.maxRounds(g)), total: E.maxRounds(g) }) : '';
  if (g.phase === 'playing') {
    const h = g.mode === 'turns' ? g.hand : g.hands[me.id];
    const ap = g.players[g.activeIdx];
    vals.active = { color: ap.color, initial: initial(ap.name) }; vals.waitTitle = t('wait_turn', { name: ap.name });
    vals.turnTitle = g.mode === 'turns' ? t('your_turn') : t('rolling');
    vals.tabIsDice = ph.tab === 'dice'; vals.tabIsSheet = ph.tab === 'sheet';
    vals.tabDiceBg = ph.tab === 'dice' ? '#FFF9EE' : 'transparent'; vals.tabSheetBg = ph.tab === 'sheet' ? '#FFF9EE' : 'transparent';
    vals.sheetBadge = '';
    vals.rollsLabel = h.rollsLeft === 0 ? t('no_rolls') : h.rollsLeft === 1 ? t('rolls_left_one') : t('rolls_left', { n: h.rollsLeft });
    vals.rollDots = [0,1,2].map(i => i < h.rollsLeft ? me.color : '#D9C7B0');
    // live shake / reveal sync: while shaking, rolling or landing (DICE_SETTLE_MS) the non-held dice tumble with hidden values
    const tumbling = ph.shaking || ph.rolling || ph.settling;
    const hidden = ph.rolling || ph.settling; // new values exist but aren't revealed yet
    const reveal = !hidden;
    vals.dice = h.dice.map((v, i) => {
      const held = h.held[i] && h.rolled; const spin = tumbling && !held;
      return { pips: [0,1,2,3,4,5,6,7,8].map(k => PIPS[v].includes(k) && !spin ? 1 : 0), ring: held ? me.color : 'transparent', lift: held ? -8 : 0, tagColor: me.color, tagOp: held ? 1 : 0,
        key: spin ? 'spin' : 'still' + (h.rollId || 0), opacity: spin ? .8 : 1,
        anim: spin ? (reduced ? 'none' : `${i % 2 ? 'tumbleLoopA' : 'tumbleLoopB'} ${.5 + i * .06}s linear infinite`) : (!h.rolled || held || reduced) ? 'none' : (((h.rollId||0) % 2 ? 'tumbleA' : 'tumbleB') + ' .55s ease-out'),
        toggle: () => h.rolled && reveal && !ph.shaking && act('hold', i) };
    });
    vals.diceOpacity = h.rolled || tumbling ? 1 : .45;
    vals.diceHint = ph.settling || ph.rolling ? t('settling') : ph.shaking ? t('shaking') : h.rolled ? t('tap_to_hold') : ' ';
    vals.servidaVisible = variant === 'generala' && h.rolled && h.rollsLeft === 2 && reveal;
    const canRoll = h.rollsLeft > 0 && !ph.busy && !hidden;
    vals.rollBg = canRoll ? me.color : '#D9C7B0'; vals.rollFg = '#1E1715';
    vals.rollLabel = ph.shaking ? '🎲 ' + t('shaking') : hidden ? t('settling') : ph.busy ? t('processing') : h.rollsLeft === 0 ? t('no_rolls') : h.rolled ? '🎲 ' + t('roll_again') : '🎲 ' + t('roll');
    vals.rollScale = ph.shaking ? .97 : 1;
    vals.shakeVisible = ph.motion === 'granted' && h.rollsLeft > 0; vals.shakeVis = canRoll && !ph.shaking ? 'visible' : 'hidden';
    vals.shakeHintText = t('hold_to_shake');
    vals.goSheetVisible = h.rolled; vals.goSheetVis = reveal && !ph.shaking ? 'visible' : 'hidden'; // keep its space: no layout jump while landing
    const pot = E.handPotential(g, me.id);
    const cats = E.VARIANTS[variant].cats;
    vals.sheet = cats.map(c => {
      const used = me.sheet[c] !== undefined; const score = pot ? pot.scores[c] : null; const locked = !used && (score === null || score === undefined);
      const forced = pot && pot.forced === c; const selected = ph.pick === c;
      if (hidden && !used) return { key: c, label: cat(variant, c), pick: () => {}, opacity: .6, bg: '#fff', border: '#E3D6C0', deco: 'none', sub: '', score: '…', scoreColor: '#B9A48C' };
      return { key: c, label: cat(variant, c), pick: () => (!used && !locked) && act('pick', c), opacity: used ? .55 : locked ? .5 : 1,
        bg: selected ? me.color : used ? '#F1E6D2' : '#fff', border: selected ? me.color : forced ? '#FFD166' : '#E3D6C0', deco: used ? 'line-through' : 'none',
        sub: used ? t('used') : forced ? t('forced') : locked ? (h.rolled ? t('locked') : '') : '', score: used ? String(me.sheet[c]) : (score === null || score === undefined) ? '—' : String(score), scoreColor: used ? '#8A7A6A' : (score === 0 ? '#B9A48C' : '#1E1715') };
    });
    if (variant === 'yahtzee') { const tt = E.totals('yahtzee', me); vals.bonusVisible = true; vals.bonusText = t('upper_sum') + ' ' + tt.upper + ' / 63 · ' + t('upper_bonus') + ' ' + (tt.upperBonus ? '+35' : '0') + (tt.yBonus ? ' · ' + t('yahtzee_bonus') + ' +' + tt.yBonus : ''); }
    const pickOk = !hidden && ph.pick && pot && pot.scores[ph.pick] !== null && pot.scores[ph.pick] !== undefined;
    vals.confirmBg = pickOk ? '#1E1715' : '#D9C7B0'; vals.confirmFg = pickOk ? '#FFF3DF' : '#8A7A6A';
    vals.confirmLabel = pickOk ? t('confirm') + ' · ' + cat(variant, ph.pick) + ' · ' + t('pts', { n: pot.scores[ph.pick] }) : (hidden ? t('settling') : h.rolled ? t('choose_cat') : t('roll'));
    vals.confirmZeroTitle = ph.confirmZero ? t('confirm_zero_title', { cat: cat(variant, ph.confirmZero) }) : '';
    if (g.mode === 'simul') vals.simStatus = g.players.map(p => { const hh = g.hands[p.id]; return { key: p.id, name: p.name, color: p.color, initial: initial(p.name), status: hh.done ? t('ready') : (hh.rolled && hh.rollsLeft === 0) ? t('choosing') : t('rolling'), bg: hh.done ? '#9BD69B' : '#F1E6D2' }; });
  }
  if (g.phase === 'results') {
    const ranked = g.players.map(p => ({ p, total: E.totals(variant, p).total })).sort((a, b) => b.total - a.total);
    const won = g.winnerIds.includes(me.id); const tie = g.winnerIds.length > 1; const w = g.players.find(p => p.id === g.winnerIds[0]);
    vals.resultTitle = won && !tie ? t('you_won') : tie ? t('you_tied') : t('you_lost', { name: w ? w.name : '' });
    vals.resultBg = won ? me.color : '#1E1715'; vals.resultFg = won ? '#1E1715' : '#FFF3DF';
    vals.playedLabel = t('played_variant', { variant: variantName, mode: modeName });
    vals.ranking = ranked.map((x, i) => ({ key: x.p.id, rank: i + 1, name: x.p.name, color: x.p.color, initial: initial(x.p.name), total: x.total, bg: x.p.id === me.id ? '#F1E6D2' : '#fff' }));
  }
  return vals;
}

export default function GeneralaPhone({ phone }){
  if (!phone || !phone.t) return null;
  const v = computeVals(phone);
  const { T, s, on, accent } = v;

  return (
    <div data-screen-label="Celular" style={{ width: '100%', height: '100%', minHeight: '100%', boxSizing: 'border-box', background: '#FFF9EE', color: '#1E1715', fontFamily: "'Nunito',system-ui,sans-serif", display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(14px + env(safe-area-inset-top)) 18px 10px', flex: 'none' }}>
        <span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 22, letterSpacing: '-.02em' }}>Generala</span>
        {v.hasGame && <span style={{ background: accent, color: '#1E1715', borderRadius: 999, padding: '4px 10px', fontWeight: 800, fontSize: 12 }}>{v.variantName}</span>}
        <button onClick={on.lang} style={{ marginLeft: 'auto', background: '#FFF9EE', border: '2px solid #D9C7B0', borderRadius: 999, padding: '8px 12px', fontSize: 13, fontWeight: 800, color: '#1E1715', minHeight: 36 }}>{v.langToggle}</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {s.scan && (
          <div data-screen-label="Celular · Ingreso con código" style={{ padding: '16px 18px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 10 }}>
              <i style={{ width: 44, height: 44, borderRadius: 12, background: dieFace, boxShadow: '0 10px 18px -10px rgba(0,0,0,.5),inset 0 -4px 0 rgba(0,0,0,.08)', transform: 'rotate(-10deg)' }} />
              <i style={{ width: 44, height: 44, borderRadius: 12, background: '#E8603C', boxShadow: '0 10px 18px -10px rgba(0,0,0,.5)', transform: 'rotate(8deg) translateY(6px)' }} />
              <i style={{ width: 44, height: 44, borderRadius: 12, background: '#5B8DEF', boxShadow: '0 10px 18px -10px rgba(0,0,0,.5)', transform: 'rotate(-4deg)' }} />
            </div>
            <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 28, textAlign: 'center', lineHeight: 1.1 }}>{T.join_title}</div>
            <div style={{ textAlign: 'center', color: '#6E6052', fontSize: 15, lineHeight: 1.4, textWrap: 'pretty' }}>{T.scan_hint}</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}><span style={label}>{T.room_code}</span><input value={v.codeDraft} onChange={on.code} placeholder={T.code_placeholder} maxLength={4} autoCapitalize="characters" style={{ border: '2px solid #D9C7B0', borderRadius: 14, padding: '14px 16px', fontSize: 26, fontWeight: 800, letterSpacing: '.3em', textAlign: 'center', background: '#fff', color: '#1E1715', outline: 'none', textTransform: 'uppercase', fontFamily: fredoka, minWidth: 0 }} /></label>
            <button onClick={on.find} style={{ ...darkBtn, fontSize: 18 }}>{T.find_room}</button>
            {v.hasError && <div style={{ ...errorBox, display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ width: 22, height: 22, borderRadius: '50%', background: '#E8603C', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, flex: 'none' }}>!</span>{v.errorText}</div>}
          </div>
        )}

        {s.join && (
          <div data-screen-label="Celular · Unirse" style={{ padding: '8px 18px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ background: '#1E1715', color: '#FFF3DF', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><span style={{ ...label, color: '#B9A48C' }}>{v.roomLabel}</span><span style={{ fontSize: 17, fontWeight: 800 }}>{v.variantName} · {v.modeName}</span></div><span style={{ marginLeft: 'auto', fontFamily: fredoka, fontWeight: 700, fontSize: 26, letterSpacing: '.12em' }}>{v.roomCode}</span></div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>{T.nickname}</span><input value={v.nameDraft} onChange={on.name} maxLength={14} style={{ border: '2px solid #D9C7B0', borderRadius: 14, padding: '14px 16px', fontSize: 20, fontWeight: 800, background: '#fff', color: '#1E1715', outline: 'none', minWidth: 0 }} /></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={label}>{T.pick_color}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                {v.colors.map(c => <button key={c.color} onClick={c.pick} style={{ flex: 1, height: 56, borderRadius: 16, background: c.color, border: `4px solid ${c.border}`, opacity: c.opacity, fontSize: 22, fontWeight: 800, color: '#1E1715', display: 'grid', placeItems: 'center' }}>{c.mark}</button>)}
              </div>
            </div>
            <button onClick={on.join} style={{ background: accent, color: '#1E1715', border: 'none', borderRadius: 16, padding: 16, fontSize: 19, fontWeight: 800, minHeight: 56, opacity: v.joinOpacity }}>{v.joinLabel}</button>
            {v.hasError && <div style={errorBox}>{v.errorText}</div>}
            <button onClick={on.manual} style={{ background: 'transparent', border: 'none', color: '#B8472A', fontWeight: 800, fontSize: 14, padding: 8, textDecoration: 'underline' }}>{T.manual_code}</button>
          </div>
        )}

        {s.motion && (
          <div data-screen-label="Celular · Activar movimiento" style={centered}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#F1E6D2', display: 'grid', placeItems: 'center', marginTop: 12 }}><div style={{ width: 56, height: 56, borderRadius: 14, background: dieFace, boxShadow: '0 10px 18px -10px rgba(0,0,0,.5),inset 0 -4px 0 rgba(0,0,0,.08)', animation: v.shakeAnim }} /></div>
            <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 26, lineHeight: 1.15, textWrap: 'pretty' }}>{T.motion_title}</div>
            <div style={{ color: '#6E6052', fontSize: 15, lineHeight: 1.45, textWrap: 'pretty' }}>{T.motion_desc}</div>
            <button onClick={on.motionAllow} style={{ width: '100%', background: accent, color: '#1E1715', border: 'none', borderRadius: 16, padding: 16, fontSize: 18, fontWeight: 800, minHeight: 56, marginTop: 'auto' }}>{T.motion_allow}</button>
            <button onClick={on.motionSkip} style={{ ...outlineBtn, width: '100%', padding: 14, fontSize: 17, minHeight: 52 }}>{T.motion_skip}</button>
          </div>
        )}

        {s.wait && (
          <div data-screen-label="Celular · Espera en sala" style={{ padding: '8px 18px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: v.me.color, borderRadius: 18, padding: '14px 16px' }}><span style={{ width: 48, height: 48, borderRadius: '50%', background: '#FFF9EE', display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 26 }}>{v.me.initial}</span><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 19, fontWeight: 800 }}>{v.me.name}</span><span style={{ fontSize: 14, fontWeight: 800, opacity: .75 }}>✓ {T.joined}</span></div></div>
            {v.motionNote && <div style={{ fontSize: 13, color: '#6E6052', background: '#F1E6D2', borderRadius: 12, padding: '10px 12px', lineHeight: 1.4 }}>{v.motionNoteText}</div>}
            <span style={label}>{T.players_label}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {v.others.map(p => <div key={p.key} style={listRow}><span style={{ ...smallAvatar, background: p.color }}>{p.initial}</span><span style={{ fontWeight: 800, fontSize: 16 }}>{p.name}</span><span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: p.connColor }}>{p.connLabel}</span></div>)}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, color: '#6E6052', fontSize: 15, fontWeight: 700 }}><i style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid #D9C7B0', borderTopColor: accent, animation: v.spinAnim, flex: 'none', boxSizing: 'border-box' }} /><span style={{ textWrap: 'pretty' }}>{T.waiting_host}</span></div>
            <button onClick={on.rules} style={outlineBtn}>{T.rules} · {v.variantName}</button>
          </div>
        )}

        {s.turn && (
          <div data-screen-label="Celular · Turno activo" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '0 18px', display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: v.me.color }} /><span style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 22 }}>{v.turnTitle}</span><span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#6E6052' }}>{v.roundLabel}</span></div>
            <div style={{ margin: '12px 18px 0', display: 'flex', background: '#F1E6D2', borderRadius: 14, padding: 4 }}>
              <button onClick={on.tabDice} style={{ flex: 1, border: 'none', borderRadius: 11, padding: 10, fontSize: 15, fontWeight: 800, background: v.tabDiceBg, color: '#1E1715', minHeight: 40 }}>{T.see_dice}</button>
              <button onClick={on.tabSheet} style={{ flex: 1, border: 'none', borderRadius: 11, padding: 10, fontSize: 15, fontWeight: 800, background: v.tabSheetBg, color: '#1E1715', minHeight: 40 }}>{T.see_sheet} {v.sheetBadge}</button>
            </div>

            {v.tabIsDice && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '18px 18px 20px', gap: 16, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 15, fontWeight: 800, color: '#6E6052' }}>{v.rollsLabel}</span><div style={{ display: 'flex', gap: 6 }}>{v.rollDots.map((d, i) => <i key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: d }} />)}</div></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, padding: '22px 0 10px', flex: 1, alignItems: 'center', minWidth: 0, opacity: v.diceOpacity }}>
                  {v.dice.map((d, i) => (
                    <button key={i} data-die={i} data-hidden={d.pips.every(p => !p) ? 1 : 0} aria-pressed={d.tagOp === 1} onClick={d.toggle} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, transform: `translateY(${d.lift}px)`, transition: 'transform .2s' }}>
                      <span key={d.key} style={{ width: 50, height: 50, borderRadius: 13, background: dieFace, opacity: d.opacity, boxShadow: `inset 0 -4px 0 rgba(0,0,0,.08),0 10px 18px -10px rgba(0,0,0,.6),0 0 0 4px ${d.ring}`, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: 9, boxSizing: 'border-box', placeItems: 'center', animation: d.anim }}>
                        {d.pips.map((p, k) => <i key={k} style={{ width: 8, height: 8, borderRadius: '50%', background: '#2A211C', opacity: p }} />)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: d.tagColor, opacity: d.tagOp, textTransform: 'uppercase', letterSpacing: '.04em' }}>✓</span>
                    </button>
                  ))}
                </div>
                <div style={{ textAlign: 'center', fontSize: 14, color: '#6E6052', fontWeight: 700, textWrap: 'pretty' }}>{v.diceHint}</div>
                {v.servidaVisible && <div style={{ alignSelf: 'center', background: '#FFD166', borderRadius: 999, padding: '4px 12px', fontWeight: 800, fontSize: 13 }}>{T.served}</div>}
                <button data-roll="1" onPointerDown={on.rollDown} onPointerUp={on.rollUp} onPointerCancel={on.rollCancel} onClick={on.rollClick} onContextMenu={on.noMenu}
                  style={{ background: v.rollBg, color: v.rollFg, border: 'none', borderRadius: 20, padding: 20, fontSize: 22, fontWeight: 800, minHeight: 68, boxShadow: '0 14px 24px -14px rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', transform: `scale(${v.rollScale})`, transition: 'transform .15s' }}>{v.rollLabel}</button>
                {v.shakeVisible && <div style={{ textAlign: 'center', fontSize: 13, color: '#8A7A6A', fontWeight: 700, visibility: v.shakeVis }}>{v.shakeHintText}</div>}
                {v.goSheetVisible && <button onClick={on.tabSheet} style={{ ...outlineBtn, padding: 13, visibility: v.goSheetVis }}>{T.choose_cat} →</button>}
              </div>
            )}

            {v.tabIsSheet && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {v.sheet.map(r => (
                    <button key={r.key} data-cat={r.key} data-score={r.score} data-used={r.sub === T.used ? 1 : 0} onClick={r.pick} style={{ display: 'flex', alignItems: 'center', gap: 10, background: r.bg, border: `2px solid ${r.border}`, borderRadius: 14, padding: '10px 14px', minHeight: 50, textAlign: 'left', opacity: r.opacity, color: '#1E1715', flex: 'none' }}>
                      <span style={{ fontWeight: 800, fontSize: 16, flex: 1, textDecoration: r.deco }}>{r.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8A7A6A' }}>{r.sub}</span>
                      <span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 22, minWidth: 40, textAlign: 'right', color: r.scoreColor }}>{r.score}</span>
                    </button>
                  ))}
                  {v.bonusVisible && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#6E6052', padding: '6px 14px' }}>{v.bonusText}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, padding: '6px 14px' }}><span>{T.total}</span><span style={{ fontFamily: fredoka, fontSize: 22 }}>{v.myTotal}</span></div>
                </div>
                <div style={{ padding: '10px 18px calc(20px + env(safe-area-inset-bottom))', borderTop: '1px solid #E3D6C0', background: '#FFF9EE', position: 'sticky', bottom: 0, marginTop: 'auto', zIndex: 2 }}>
                  <button onClick={on.confirm} style={{ width: '100%', background: v.confirmBg, color: v.confirmFg, border: 'none', borderRadius: 18, padding: 18, fontSize: 20, fontWeight: 800, minHeight: 60 }}>{v.confirmLabel}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {s.waitTurn && (
          <div data-screen-label="Celular · Esperando turno" style={centered}>
            <span style={{ marginTop: 16, width: 96, height: 96, borderRadius: '50%', background: v.active.color, display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 48, animation: v.shimmerAnim }}>{v.active.initial}</span>
            <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 28, lineHeight: 1.1 }}>{v.waitTitle}</div>
            <div style={{ color: '#6E6052', fontSize: 15, lineHeight: 1.45, textWrap: 'pretty' }}>{T.wait_turn_desc}</div>
            <div style={scoreCard}><span style={{ fontWeight: 800, fontSize: 14, color: '#6E6052' }}>{T.your_score}</span><span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 30 }}>{v.myTotal}</span></div>
            <div style={{ width: '100%', fontSize: 13, color: '#6E6052', fontWeight: 700 }}>{v.roundLabel}</div>
            <button onClick={on.rules} style={{ ...outlineBtn, width: '100%' }}>{T.rules} · {v.variantName}</button>
          </div>
        )}

        {s.doneRound && (
          <div data-screen-label="Celular · Ronda terminada" style={centered}>
            <span style={{ marginTop: 16, width: 96, height: 96, borderRadius: '50%', background: '#9BD69B', display: 'grid', placeItems: 'center', fontSize: 48, fontWeight: 800 }}>✓</span>
            <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 28 }}>{T.done_round}</div>
            <div style={{ color: '#6E6052', fontSize: 15, textWrap: 'pretty' }}>{T.done_round_desc}</div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {(v.simStatus || []).map(p => <div key={p.key} style={listRow}><span style={{ ...smallAvatar, background: p.color }}>{p.initial}</span><span style={{ fontWeight: 800, fontSize: 16 }}>{p.name}</span><span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, background: p.bg, borderRadius: 999, padding: '4px 10px' }}>{p.status}</span></div>)}
            </div>
            <div style={scoreCard}><span style={{ fontWeight: 800, fontSize: 14, color: '#6E6052' }}>{T.your_score}</span><span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 30 }}>{v.myTotal}</span></div>
          </div>
        )}

        {s.paused && (
          <div data-screen-label="Celular · Pausa" style={{ ...centered, gap: 12, justifyContent: 'center' }}>
            <div style={{ fontSize: 48 }}>⏸</div><div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 26 }}>{T.paused}</div><div style={{ color: '#6E6052', fontSize: 15, textWrap: 'pretty' }}>{T.paused_desc}</div>
          </div>
        )}

        {s.results && v.ranking && (
          <div data-screen-label="Celular · Resultados" style={{ padding: '8px 18px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ background: v.resultBg, color: v.resultFg, borderRadius: 20, padding: '22px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, animation: v.popAnim }}><span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 32, lineHeight: 1.05, textWrap: 'pretty' }}>{v.resultTitle}</span><span style={{ fontSize: 14, fontWeight: 800, opacity: .8 }}>{v.playedLabel}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {v.ranking.map(p => <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: p.bg, border: '1px solid #E3D6C0', borderRadius: 14 }}><span style={{ fontFamily: fredoka, fontWeight: 700, fontSize: 18, width: 22, opacity: .6 }}>{p.rank}</span><span style={{ width: 34, height: 34, borderRadius: '50%', background: p.color, display: 'grid', placeItems: 'center', fontFamily: fredoka, fontWeight: 700, fontSize: 18 }}>{p.initial}</span><span style={{ fontWeight: 800, fontSize: 16 }}>{p.name}</span><span style={{ marginLeft: 'auto', fontFamily: fredoka, fontWeight: 700, fontSize: 24 }}>{p.total}</span></div>)}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, color: '#6E6052', fontSize: 15, fontWeight: 700 }}><i style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid #D9C7B0', borderTopColor: accent, animation: v.spinAnim, flex: 'none', boxSizing: 'border-box' }} /><span style={{ textWrap: 'pretty' }}>{T.waiting_rematch}</span></div>
          </div>
        )}

        {s.error && (
          <div data-screen-label="Celular · Error de sala" style={{ ...centered, gap: 14, justifyContent: 'center' }}>
            <span style={{ width: 72, height: 72, borderRadius: '50%', background: '#FBE3DA', color: '#E8603C', display: 'grid', placeItems: 'center', fontSize: 40, fontWeight: 800 }}>!</span>
            <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 26, lineHeight: 1.1, textWrap: 'pretty' }}>{v.errorText}</div>
            <button onClick={on.clearError} style={{ ...darkBtn, width: '100%', marginTop: 16 }}>{T.try_again}</button>
          </div>
        )}

        {s.loading && (
          <div data-screen-label="Celular · Cargando" style={{ ...centered, justifyContent: 'center' }}>
            <i style={{ width: 44, height: 44, borderRadius: '50%', border: '5px solid #E3D6C0', borderTopColor: accent, animation: v.spinAnim, boxSizing: 'border-box' }} />
          </div>
        )}

        {s.reconnecting && (
          <div data-screen-label="Celular · Reconectando" style={{ ...centered, gap: 14, justifyContent: 'center' }}>
            <i style={{ width: 56, height: 56, borderRadius: '50%', border: '6px solid #E3D6C0', borderTopColor: accent, animation: v.spinAnim, boxSizing: 'border-box' }} />
            <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 26 }}>{T.reconnecting_title}</div>
            <div style={{ color: '#6E6052', fontSize: 15, lineHeight: 1.45, textWrap: 'pretty' }}>{T.reconnecting_desc}</div>
            <button onClick={on.reconnect} style={{ ...darkBtn, width: '100%', marginTop: 16 }}>{T.simulate_reconnect}</button>
          </div>
        )}
      </div>

      {v.confirmZeroVisible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(30,23,21,.55)', display: 'flex', alignItems: 'flex-end', padding: '14px 14px calc(14px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
          <div style={{ width: '100%', background: '#FFF9EE', borderRadius: 22, padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box', animation: v.popAnim }}>
            <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 24, lineHeight: 1.1, textWrap: 'pretty' }}>{v.confirmZeroTitle}</div>
            <div style={{ color: '#6E6052', fontSize: 15, lineHeight: 1.4 }}>{T.confirm_zero_desc}</div>
            <button onClick={on.confirmZeroYes} style={darkBtn}>{T.confirm_zero_yes}</button>
            <button onClick={on.cancelZero} style={{ ...outlineBtn, padding: 14, minHeight: 52 }}>{T.cancel}</button>
          </div>
        </div>
      )}

      {v.rulesVisible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: '#FFF9EE', display: 'flex', flexDirection: 'column', padding: 'calc(14px + env(safe-area-inset-top)) 18px calc(20px + env(safe-area-inset-bottom))', boxSizing: 'border-box', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ fontFamily: fredoka, fontWeight: 600, fontSize: 24 }}>{v.helpTitle}</span><button onClick={on.rules} style={{ marginLeft: 'auto', background: '#1E1715', color: '#FFF3DF', border: 'none', borderRadius: 999, padding: '8px 16px', fontSize: 14, fontWeight: 800, minHeight: 40 }}>{T.close}</button></div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {v.rules.map((r, i) => <div key={i} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.45, color: '#3A2F28' }}><span style={{ fontFamily: fredoka, color: accent, fontWeight: 700, width: 18, flex: 'none' }}>{i + 1}</span><span style={{ textWrap: 'pretty' }}>{r}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
