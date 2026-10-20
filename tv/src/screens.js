// TV screens — React Native port of backend/src/GeneralaTV.jsx (1280x720 design units, scaled by sx/px).
import React from 'react';
import { View } from 'react-native';
import { C, Txt, FButton, Avatar, Pill, Die, Narrator, QR } from './ui/components';
import { sx, px } from './ui/scale';
import { Dice3D } from './ui/Dice3D';
import { DICE3D_ENABLED } from './config';

const eyebrow = { fontSize: 20, fontWeight: '800', letterSpacing: 2, color: C.muted };
const ghostBtn = { borderWidth: 3, borderColor: '#5A4A42', borderRadius: 999, paddingVertical: 17, paddingHorizontal: 30, alignItems: 'center', justifyContent: 'center' };
const ghostTxt = { fontSize: 24, fontWeight: '700' };
const pillBtn = { backgroundColor: C.card, borderWidth: 3, borderColor: C.cardBorder, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 };
const pillTxt = { fontSize: 19, fontWeight: '700' };
// U+FE0E asks for the text (not emoji) presentation of the glyph
const PLAY = '▶\uFE0E';
const screen = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

function AccentBtn({ v, on, id, label, preferred, dim, style, size = 28 }){
  return (
    <FButton onPress={on[id]} preferred={preferred} dim={dim} testID={id} style={[{ backgroundColor: v.accent, borderRadius: 999, paddingVertical: 20, paddingHorizontal: 44, alignItems: 'center' }, style]}>
      <Txt style={{ fontSize: size, fontWeight: '800', color: C.inkDark }}>{label}</Txt>
    </FButton>
  );
}
function GhostBtn({ on, id, label, preferred, style, size = 24, focusable }){
  return (
    <FButton onPress={on[id]} preferred={preferred} testID={id} focusable={focusable} style={[ghostBtn, style]}>
      <Txt style={[ghostTxt, { fontSize: size }]}>{label}</Txt>
    </FButton>
  );
}

function HomeDie({ rotate, dy, pip, value }){
  return (
    <View style={{ transform: [{ rotate: rotate + 'deg' }, { translateY: px(dy) }] }}>
      <Die value={value} size={84} radius={22} pipSize={14} pad={14} pipColor={pip} />
    </View>
  );
}

export function Home({ v, on }){
  const { T } = v;
  const cards = [
    { id: 'vG', name: 'Generala', dot: C.generala, border: v.vGBorder, check: v.vGCheck, desc: T.v_generala_desc },
    { id: 'vY', name: 'Yahtzee', dot: C.yahtzee, border: v.vYBorder, check: v.vYCheck, desc: T.v_yahtzee_desc },
  ];
  return (
    <View style={sx(screen, { paddingVertical: 56, paddingHorizontal: 72 })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View>
          <Txt head style={{ fontSize: 92, fontWeight: '700', lineHeight: 96, letterSpacing: -2 }}>Generala</Txt>
          <Txt style={{ marginTop: 10, fontSize: 26, color: C.sub, fontWeight: '600' }}>{T.tagline}</Txt>
        </View>
        <View style={sx({ flexDirection: 'row', gap: 16, marginTop: 8 })}>
          <HomeDie rotate={-10} dy={0} pip={C.pip} value={3} />
          <HomeDie rotate={8} dy={10} pip={C.generala} value={5} />
        </View>
      </View>
      <Txt style={{ marginTop: 40, fontSize: 22, fontWeight: '800', letterSpacing: 2, color: C.muted }}>{T.home_pick.toUpperCase()}</Txt>
      <View style={sx({ flexDirection: 'row', gap: 28, marginTop: 16 })}>
        {cards.map(o => (
          <FButton key={o.id} onPress={on[o.id]} radius={28} preferred={o.check === 1} testID={o.id}
            style={{ flex: 1, backgroundColor: C.card, borderWidth: 4, borderColor: o.border, borderRadius: 28, paddingVertical: 28, paddingHorizontal: 34, minHeight: 200, gap: 12 }}>
            <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 14 })}>
              <View style={sx({ width: 18, height: 18, borderRadius: 9, backgroundColor: o.dot })} />
              <Txt head style={{ fontSize: 40, fontWeight: '600' }}>{o.name}</Txt>
              <Txt style={{ marginLeft: 'auto', fontSize: 26, fontWeight: '800', color: o.dot, opacity: o.check }}>✓</Txt>
            </View>
            <Txt style={{ fontSize: 24, lineHeight: 33, color: '#E7D8C3' }}>{o.desc}</Txt>
          </FButton>
        ))}
      </View>
      <View style={sx({ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 18 })}>
        <AccentBtn v={v} on={on} id="continue" label={T.continue + ' →'} />
        <GhostBtn on={on} id="help" label={T.how_to_play} />
        <View style={{ flex: 1 }} />
        <GhostBtn on={on} id="lang" label={'🌐 ' + v.langToggle} size={22} style={{ paddingVertical: 14, paddingHorizontal: 24 }} />
      </View>
      <Txt style={{ marginTop: 18, fontSize: 18, color: C.faint }}>{T.remote_hint}</Txt>
    </View>
  );
}

export function Setup({ v, on, busy, changing }){
  const { T } = v;
  const toggleRow = (id, label, value, bg) => (
    <FButton onPress={on[id]} radius={18} testID={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.card, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 24 }}>
      <Txt style={{ fontSize: 26, fontWeight: '800' }}>{label}</Txt>
      <View style={{ flex: 1 }} />
      <Pill bg={bg} size={22} padH={18} padV={6}>{value}</Pill>
    </FButton>
  );
  const modeCard = (id, title, desc, border, tag) => (
    <FButton onPress={on[id]} radius={22} preferred={id === 'mTurns'} testID={id} style={{ flex: 1, backgroundColor: C.card, borderWidth: 4, borderColor: border, borderRadius: 22, paddingVertical: 20, paddingHorizontal: 24, gap: 8 }}>
      <View style={sx({ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4 })}>
        <Txt style={{ fontSize: 28, fontWeight: '800' }}>{title}</Txt>
        {tag ? <View style={sx({ backgroundColor: C.chip, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 })}><Txt style={{ fontSize: 14, fontWeight: '800', letterSpacing: 1 }}>{tag.toUpperCase()}</Txt></View> : null}
      </View>
      <Txt style={{ fontSize: 20, lineHeight: 27, color: C.sub }}>{desc}</Txt>
    </FButton>
  );
  return (
    <View style={sx(screen, { paddingVertical: 44, paddingHorizontal: 72, gap: 24 })}>
      <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 20 })}>
        <Txt head style={{ fontSize: 44, fontWeight: '600' }}>{T.setup_title}</Txt>
        <View style={{ flex: 1 }} />
        <Pill bg={v.accent} size={22} padH={22} padV={10}>{T.rules_variant + ': ' + v.variantName}</Pill>
      </View>
      <View style={sx({ flexDirection: 'row', gap: 36, flex: 1 })}>
        <View style={sx({ flex: 1.2, gap: 18 })}>
          <Txt style={eyebrow}>{T.mode_label.toUpperCase()}</Txt>
          <View style={sx({ flexDirection: 'row', gap: 16 })}>
            {modeCard('mTurns', T.mode_turns, T.mode_turns_desc, v.mTurnsBorder)}
            {modeCard('mSimul', T.mode_simul, T.mode_simul_desc, v.mSimulBorder, T.mode_simul_tag)}
          </View>
          {toggleRow('narr', T.narrator_label, v.narrLabel, v.narrBg)}
          {toggleRow('len', T.demo_len, v.lenLabel, C.sub)}
        </View>
        <View style={sx({ flex: 1, backgroundColor: C.card, borderRadius: 22, paddingVertical: 24, paddingHorizontal: 28, gap: 12, overflow: 'hidden' })}>
          <Txt style={eyebrow}>{T.rules_summary.toUpperCase()}</Txt>
          {v.rulesShort.map((r, i) => (
            <View key={i} style={sx({ flexDirection: 'row', gap: 12 })}>
              <Txt style={{ fontSize: 20, color: v.accent, fontWeight: '800' }}>•</Txt>
              <Txt style={{ flex: 1, fontSize: 19, lineHeight: 26, color: '#E7D8C3' }}>{r}</Txt>
            </View>
          ))}
        </View>
      </View>
      <View style={sx({ flexDirection: 'row', gap: 18, alignItems: 'center' })}>
        <AccentBtn v={v} on={on} id="create" label={busy ? '…' : (changing ? '↻ ' + T.rematch : T.create_room)} dim={busy} />
        <GhostBtn on={on} id="back" label={'← ' + T.back} />
      </View>
    </View>
  );
}

export function Lobby({ v, on, joinUrl }){
  const { T } = v;
  const baseUrl = (joinUrl || '').replace(/^https?:\/\//, '').replace(/\/?\?.*$/, '');
  return (
    <View style={sx(screen, { paddingVertical: 40, paddingHorizontal: 72, flexDirection: 'row', gap: 56 })}>
      <View style={sx({ width: 440, alignItems: 'center', gap: 16 })}>
        <View style={sx({ backgroundColor: C.paper, borderRadius: 28, padding: 22 })}>
          <QR value={joinUrl} size={300} />
        </View>
        <Txt style={{ fontSize: 22, color: C.sub, textAlign: 'center', fontWeight: '700' }}>{T.scan_qr}</Txt>
        <Txt head style={{ fontSize: 72, fontWeight: '700', letterSpacing: 13, lineHeight: 80, marginLeft: 13 }}>{v.roomCode}</Txt>
        <Txt lines={2} style={{ fontSize: 18, color: C.faint, textAlign: 'center' }}>{T.or_enter_code_url ? T.or_enter_code_url.replace('{url}', baseUrl) : baseUrl}</Txt>
      </View>
      <View style={sx({ flex: 1, gap: 20 })}>
        <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 14 })}>
          <Txt head style={{ fontSize: 44, fontWeight: '600' }}>{T.lobby_title}</Txt>
          <Pill bg={v.accent} size={20} padH={18} padV={8}>{v.variantName}</Pill>
          <Pill bg={C.chip} fg={C.ink} size={20} padH={18} padV={8}>{v.modeName}</Pill>
        </View>
        <View style={sx({ flexDirection: 'row', flexWrap: 'wrap', gap: 14 })}>
          {v.lobbyPlayers.map(p => (
            <View key={p.key} style={sx({ width: 313, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 20, minHeight: 84, borderWidth: 3, borderColor: p.border })}>
              <Avatar color={p.color} initial={p.initial} />
              <View style={{ flex: 1 }}>
                <Txt lines={1} style={{ fontSize: 26, fontWeight: '800', color: p.empty ? C.faint : C.ink }}>{p.name}</Txt>
                {p.empty ? null : (
                  <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 8 })}>
                    <View style={sx({ width: 10, height: 10, borderRadius: 5, backgroundColor: p.connColor })} />
                    <Txt style={{ fontSize: 17, color: p.connColor, fontWeight: '700' }}>{p.connLabel}</Txt>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
        <Txt style={{ fontSize: 22, color: C.muted, fontWeight: '700' }}>{v.lobbyHint}</Txt>
        <View style={sx({ marginTop: 'auto', flexDirection: 'row', gap: 18, alignItems: 'center' })}>
          <AccentBtn v={v} on={on} id="start" label={PLAY + ' ' + T.start_game} preferred dim={!v.canStart} size={24} style={{ paddingHorizontal: 32, paddingVertical: 18 }} />
          <GhostBtn on={on} id="leave" label={T.leave_room} size={22} style={{ paddingHorizontal: 24, paddingVertical: 15 }} />
          <View style={{ flex: 1 }} />
          <GhostBtn on={on} id="lang" label={v.langToggle} size={20} style={{ paddingVertical: 15, paddingHorizontal: 20 }} />
        </View>
      </View>
    </View>
  );
}

function SheetTable({ v }){
  const colW = 86;
  return (
    <View style={sx({ width: 520, backgroundColor: C.paper, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18, overflow: 'hidden' })}>
      <View style={sx({ flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#E3D6C0' })}>
        <Txt style={{ flex: 1, fontSize: 14, fontWeight: '800', letterSpacing: 1, color: '#8A7A6A' }}>{v.variantName.toUpperCase()}</Txt>
        {v.cols.map(c => (
          <View key={c.key} style={sx({ width: colW, alignItems: 'center', gap: 3 })}>
            <Avatar color={c.color} initial={c.initial} size={34} font={19} ring={c.ring} />
            <Txt lines={1} style={{ fontSize: 13, fontWeight: '800', color: C.inkDark, maxWidth: 84 }}>{c.name}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flex: 1, justifyContent: 'space-evenly' }}>
        {v.rows.map(r => (
          <View key={r.key} style={sx({ flexDirection: 'row', alignItems: 'center', backgroundColor: r.bg, borderRadius: 8, paddingVertical: 1, paddingHorizontal: 6 })}>
            <Txt lines={1} style={{ flex: 1, fontSize: r.size, fontWeight: r.weight, color: r.labelColor }}>{r.label}</Txt>
            {r.cells.map((c, i) => (
              <Txt key={i} style={{ width: colW, textAlign: 'center', fontSize: r.size, fontWeight: c.weight, color: c.color, fontVariant: ['tabular-nums'] }}>{c.text}</Txt>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function TurnsBoard({ v, on }){
  const { T } = v;
  // 3D dice (WebView) with the 2D row as loading/failure fallback. The 3D view rings and lifts held dice itself.
  const use3d = DICE3D_ENABLED && !!v.dice3d;
  const diceRow = (
    <View style={sx({ flexDirection: 'row', gap: 22, alignItems: 'flex-end', height: 150, paddingTop: 14 })}>
      {v.dice.map(d => (
        <View key={d.key} style={sx({ alignItems: 'center', gap: 8 })}>
          <Die value={d.v} held={d.held} ring={d.ring} lift={d.held ? 14 : 0} rollKey={d.rollKey} reduced={v.reduced} />
          <Txt style={{ fontSize: 15, fontWeight: '800', letterSpacing: 1, color: d.ring || C.muted, opacity: d.held ? 1 : 0 }}>{'✓ ' + T.hold_tag.toUpperCase()}</Txt>
        </View>
      ))}
    </View>
  );
  return (
    <View style={sx({ flex: 1, flexDirection: 'row', gap: 28 })}>
      <View style={sx({ flex: 1, gap: 18 })}>
        <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: C.card, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 24, borderLeftWidth: 14, borderLeftColor: v.active.color })}>
          <Avatar color={v.active.color} initial={v.active.initial} size={68} font={36} />
          <View style={{ flex: 1 }}>
            <Txt lines={1} style={{ fontSize: 34, fontWeight: '800', lineHeight: 40 }}>{v.turnLabel}</Txt>
            <Txt style={{ fontSize: 20, color: C.sub, fontWeight: '700' }}>{v.statusLabel}</Txt>
          </View>
          <View style={sx({ alignItems: 'flex-end', gap: 6 })}>
            <Txt style={{ fontSize: 20, fontWeight: '800', color: C.sub }}>{v.rollsLabel}</Txt>
            <View style={sx({ flexDirection: 'row', gap: 8 })}>
              {v.rollDots.map((d, i) => <View key={i} style={sx({ width: 16, height: 16, borderRadius: 8, backgroundColor: d })} />)}
            </View>
          </View>
        </View>
        <View style={sx({ flex: 1, backgroundColor: C.table, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 22, overflow: 'hidden' }, use3d ? { gap: 0, paddingBottom: 20 } : null)}>
          {use3d ? <Dice3D msg={v.dice3d} onSettled={on.diceSettled} bgColor={C.table} style={sx({ alignSelf: 'stretch', flex: 1, marginTop: 12 })} fallback={diceRow} /> : diceRow}
          <Txt style={{ fontSize: 19, color: C.faint, fontWeight: '700' }}>{T.hold_hint}</Txt>
          {v.servidaVisible ? (
            <View style={sx({ position: 'absolute', top: 18, right: 22 })}><Pill bg={C.focus} size={18} padH={16} padV={6}>{T.served}</Pill></View>
          ) : null}
        </View>
        {v.feedVisible ? <Narrator tag={T.narrator_tag} text={v.feedText} reduced={v.reduced} /> : null}
      </View>
      <SheetTable v={v} />
    </View>
  );
}

function SimulBoard({ v }){
  const { T } = v;
  return (
    <View style={sx({ flex: 1, gap: 16 })}>
      <View style={sx({ flex: 1, flexDirection: 'row', gap: 18 })}>
        {v.panels.map(p => (
          <View key={p.key} style={sx({ flex: 1, backgroundColor: C.card, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20, gap: 12, borderTopWidth: 10, borderTopColor: p.color, opacity: p.opacity })}>
            <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 12 })}>
              <Avatar color={p.color} initial={p.initial} size={48} font={26} />
              <Txt lines={1} style={{ flex: 1, fontSize: 26, fontWeight: '800' }}>{p.name}</Txt>
              <Pill bg={p.statusBg} fg={p.statusFg} size={16} padH={12} padV={4}>{p.status}</Pill>
            </View>
            <View style={sx({ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 6 })}>
              {p.dice.map(d => <Die key={d.key} value={d.v} held={d.held} ring={d.ring} lift={d.held ? 6 : 0} rollKey={d.rollKey} reduced={v.reduced} size={52} radius={12} pipSize={8} pad={8} />)}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt style={{ fontSize: 18, color: C.sub, fontWeight: '700' }}>{p.rollsLabel}</Txt>
              <Txt style={{ fontSize: 18, color: C.sub, fontWeight: '700' }}>{p.progress}</Txt>
            </View>
            <View style={sx({ height: 8, borderRadius: 4, backgroundColor: C.cardBorder, overflow: 'hidden' })}>
              <View style={{ height: '100%', width: p.pct + '%', backgroundColor: p.color }} />
            </View>
            <View style={sx({ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', rowGap: 3, overflow: 'hidden' })}>
              {p.rows.map(r => (
                <View key={r.key} style={sx({ width: '50%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 1, backgroundColor: r.bg, borderRadius: 6 })}>
                  <Txt lines={1} style={{ flex: 1, fontSize: 15, color: r.color, fontWeight: r.weight }}>{r.label}</Txt>
                  <Txt style={{ fontSize: 15, color: r.color, fontWeight: r.weight, marginLeft: 6 }}>{r.text}</Txt>
                </View>
              ))}
            </View>
            <View style={sx({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: C.cardBorder, paddingTop: 6 })}>
              <Txt style={{ fontSize: 18, color: C.muted, fontWeight: '800', letterSpacing: 1 }}>{T.total.toUpperCase()}</Txt>
              <Txt head style={{ fontSize: 44, fontWeight: '700', lineHeight: 50 }}>{String(p.total)}</Txt>
            </View>
          </View>
        ))}
      </View>
      {v.feedVisible ? <Narrator tag={T.narrator_tag} text={v.feedText} reduced={v.reduced} /> : null}
    </View>
  );
}

export function Playing({ v, on }){
  const { T } = v;
  const barFocusable = !v.isPaused;
  const bar = (id, label, preferred) => (
    // blockDown: the 3D dice WebView below is a native focus target on Vega even with focusable={false}
    <FButton onPress={on[id]} focusable={barFocusable} preferred={preferred && barFocusable} testID={id} style={pillBtn} blockDown={!!v.dice3d}>
      <Txt style={pillTxt}>{label}</Txt>
    </FButton>
  );
  return (
    <View style={sx(screen, { paddingTop: 28, paddingHorizontal: 44, paddingBottom: 30, gap: 18 })}>
      <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 12 })}>
        <Txt head style={{ fontSize: 30, fontWeight: '700' }}>Generala</Txt>
        <Pill bg={v.accent}>{v.variantName}</Pill>
        <Pill bg={C.chip} fg={C.ink}>{v.modeName}</Pill>
        <Txt style={{ marginLeft: 12, fontSize: 22, fontWeight: '800', color: C.sub }}>{v.roundLabel}</Txt>
        <View style={{ flex: 1 }} />
        <View style={sx({ flexDirection: 'row', gap: 10 })}>
          {bar('help', T.how_to_play)}
          {bar('mute', v.muteLabel)}
          {bar('pause', v.pauseLabel, true)}
          {bar('lang', v.langToggle)}
        </View>
      </View>
      {v.isTurns && v.active ? <TurnsBoard v={v} on={on} /> : null}
      {v.isSimul && v.panels ? <SimulBoard v={v} /> : null}
      {v.dcVisible ? (
        <View pointerEvents="none" style={sx({ position: 'absolute', top: 84, left: 0, right: 0, alignItems: 'center' })}>
          <View style={sx({ backgroundColor: C.focus, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', gap: 12 })}>
            <View style={sx({ width: 14, height: 14, borderRadius: 7, backgroundColor: C.inkDark })} />
            <Txt style={{ fontSize: 21, fontWeight: '800', color: C.inkDark }}>{v.dcText}</Txt>
          </View>
        </View>
      ) : null}
      {v.isPaused ? (
        <View style={sx(screen, { backgroundColor: 'rgba(23,18,16,0.86)', alignItems: 'center', justifyContent: 'center' })}>
          <View style={sx({ alignItems: 'center', gap: 14 })}>
            <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 22 })}>
              <View style={sx({ flexDirection: 'row', gap: 10 })}>
                <View style={sx({ width: 14, height: 52, borderRadius: 4, backgroundColor: C.ink })} />
                <View style={sx({ width: 14, height: 52, borderRadius: 4, backgroundColor: C.ink })} />
              </View>
              <Txt head style={{ fontSize: 64, fontWeight: '700' }}>{T.paused}</Txt>
            </View>
            <Txt style={{ fontSize: 24, color: C.sub, maxWidth: 640, textAlign: 'center' }}>{T.paused_desc}</Txt>
            <AccentBtn v={v} on={on} id="pause" label={PLAY + ' ' + T.resume} preferred size={26} style={{ marginTop: 10, paddingVertical: 18, paddingHorizontal: 40 }} />
            <View style={sx({ flexDirection: 'row', gap: 14, marginTop: 6 })}>
              <GhostBtn on={on} id="endGame" label={T.end_game} size={22} style={{ paddingVertical: 14, paddingHorizontal: 26 }} />
              <GhostBtn on={on} id="home" label={T.go_home} size={22} style={{ paddingVertical: 14, paddingHorizontal: 26 }} />
            </View>
            <Txt style={{ fontSize: 18, color: C.faint }}>{T.end_game_desc}</Txt>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, top: (i * 53) % 92, w: 10 + (i % 3) * 4, h: 14 + (i % 4) * 4, rot: (i * 47) % 180, color: ['#E8603C', '#2A9D8F', '#E9B44C', '#7B6CF6', '#FFF3DF'][i % 5] }));

export function Results({ v, on }){
  const { T } = v;
  return (
    <View style={sx(screen, { paddingVertical: 48, paddingHorizontal: 72, flexDirection: 'row', gap: 48 })}>
      <View pointerEvents="none" style={sx(screen)}>
        {CONFETTI.map((c, i) => <View key={i} style={{ position: 'absolute', left: c.left + '%', top: c.top + '%', width: px(c.w), height: px(c.h), borderRadius: px(3), backgroundColor: c.color, opacity: 0.35, transform: [{ rotate: c.rot + 'deg' }] }} />)}
      </View>
      <View style={sx({ flex: 1, gap: 16, justifyContent: 'center' })}>
        <Txt style={{ fontSize: 22, fontWeight: '800', letterSpacing: 2, color: C.muted }}>{T.results_title.toUpperCase()}</Txt>
        <Txt head style={{ fontSize: 60, fontWeight: '700', lineHeight: 66 }}>{v.winnerLabel}</Txt>
        <Txt style={{ fontSize: 22, color: C.sub, fontWeight: '700' }}>{v.playedLabel}</Txt>
        <View style={sx({ gap: 14, marginTop: 20, alignItems: 'flex-start' })}>
          <AccentBtn v={v} on={on} id="rematch" label={'↻ ' + T.rematch} preferred size={26} style={{ paddingVertical: 18, paddingHorizontal: 36 }} />
          <View style={sx({ flexDirection: 'row', gap: 12, flexWrap: 'wrap' })}>
            <GhostBtn on={on} id="changeVariant" label={T.change_variant} size={22} style={{ paddingVertical: 15, paddingHorizontal: 26 }} />
            <GhostBtn on={on} id="home" label={T.go_home} size={22} style={{ paddingVertical: 15, paddingHorizontal: 26 }} />
            <GhostBtn on={on} id="lang" label={v.langToggle} size={22} style={{ paddingVertical: 15, paddingHorizontal: 26 }} />
          </View>
        </View>
      </View>
      <View style={sx({ flex: 1, gap: 14, justifyContent: 'center' })}>
        {v.ranking.map(p => (
          <View key={p.key} style={[sx({ flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: p.bg, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 24 }), { transform: [{ scale: p.scale }] }]}>
            <Txt head style={{ fontSize: 34, fontWeight: '700', width: 44, opacity: 0.6, color: p.fg }}>{String(p.rank)}</Txt>
            <Avatar color={p.color} initial={p.initial} />
            <Txt lines={1} style={{ flex: 1, fontSize: 30, fontWeight: '800', color: p.fg }}>{p.name}</Txt>
            <Txt head style={{ fontSize: 44, fontWeight: '700', color: p.fg }}>{String(p.total)}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Closed({ v, on }){
  const { T } = v;
  return (
    <View style={sx(screen, { alignItems: 'center', justifyContent: 'center', padding: 72 })}>
      <View style={sx({ alignItems: 'center', gap: 16, maxWidth: 760 })}>
        <Txt head style={{ fontSize: 64, fontWeight: '700' }}>{T.room_closed}</Txt>
        <Txt style={{ fontSize: 26, color: C.sub, textAlign: 'center' }}>{T.room_closed_desc}</Txt>
        <AccentBtn v={v} on={on} id="home" label={T.go_home} preferred size={26} style={{ marginTop: 12, paddingVertical: 18, paddingHorizontal: 40 }} />
      </View>
    </View>
  );
}

export function Help({ v, on }){
  const { T } = v;
  return (
    <View style={sx(screen, { backgroundColor: 'rgba(23,18,16,0.94)', paddingVertical: 44, paddingHorizontal: 72, gap: 20 })}>
      <View style={sx({ flexDirection: 'row', alignItems: 'center', gap: 18 })}>
        <Txt head style={{ fontSize: 44, fontWeight: '600' }}>{v.helpTitle}</Txt>
        <View style={{ flex: 1 }} />
        <AccentBtn v={v} on={on} id="closeHelp" label={T.close} preferred size={24} style={{ paddingVertical: 14, paddingHorizontal: 30 }} />
      </View>
      <View style={sx({ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 })}>
        {v.rules.map((r, i) => (
          <View key={i} style={sx({ width: '50%', flexDirection: 'row', gap: 14, paddingRight: 36 })}>
            <Txt head style={{ color: v.accent, fontWeight: '700', fontSize: 26, width: 30 }}>{String(i + 1)}</Txt>
            <Txt style={{ flex: 1, fontSize: 20, lineHeight: 28, color: '#E7D8C3' }}>{r}</Txt>
          </View>
        ))}
      </View>
      <Txt style={{ marginTop: 'auto', fontSize: 18, color: C.faint }}>{T.remote_hint}</Txt>
    </View>
  );
}
