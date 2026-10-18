import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import qrcode from 'qrcode-generator';
import { px, sx } from './scale';

export const C = {
  bg: '#1E1715', bgDeep: '#171210', card: '#2B2320', cardBorder: '#3C312C', ink: '#FFF3DF', inkDark: '#1E1715',
  sub: '#D9C7B0', muted: '#B9A48C', faint: '#8F7D6A', paper: '#FFF9EE', table: '#24201B', chip: '#4A3B35',
  focus: '#FFD166', focusSoft: 'rgba(255,209,102,0.3)', green: '#9BD69B', generala: '#E8603C', yahtzee: '#5B8DEF',
  pip: '#2A211C',
};
export const FONT_HEAD = 'Fredoka';
export const FONT_TEXT = 'Nunito';

// Bundled static fonts live in tv/assets/fonts. Vega registers each file under its file name, so a
// weight is selected by picking the file (e.g. 'Nunito-Bold') instead of fontWeight (variable fonts
// ignore fontWeight on Vega, and fontWeight on a static file would add synthetic bold).
const WEIGHT_FILE = {
  [FONT_TEXT]: { 400: 'Regular', 500: 'SemiBold', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'ExtraBold' },
  [FONT_HEAD]: { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'Bold', 900: 'Bold' },
};
function fontFor(head, weight){
  const fam = head ? FONT_HEAD : FONT_TEXT;
  const w = weight === 'bold' ? 700 : (parseInt(weight, 10) || 400);
  return fam + '-' + (WEIGHT_FILE[fam][Math.min(900, Math.max(400, Math.round(w / 100) * 100))]);
}

// Text in design units. `head` switches to Fredoka.
export function Txt({ style, head, children, lines, ...rest }){
  const s = sx({ color: C.ink, fontSize: 24 }, ...(Array.isArray(style) ? style : [style]));
  s.fontFamily = fontFor(head, s.fontWeight);
  delete s.fontWeight;
  return (
    <Text numberOfLines={lines} {...rest} style={s}>
      {children}
    </Text>
  );
}

// Focusable button for the D-pad: native Vega focus (Pressable onFocus/onBlur), yellow ring when focused.
export function FButton({ onPress, style, radius = 999, preferred, focusable = true, dim, children, testID, onFocusChange }){
  const [focused, setFocused] = useState(false);
  const flat = sx(...(Array.isArray(style) ? style : [style]));
  const r = radius === 999 ? 999 : px(radius);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      focusable={focusable}
      hasTVPreferredFocus={!!preferred}
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocusChange && onFocusChange(true); }}
      onBlur={() => { setFocused(false); onFocusChange && onFocusChange(false); }}
      style={[flat, dim ? { opacity: 0.4 } : null]}>
      {focused && (
        <View pointerEvents="none" style={{ position: 'absolute', top: -px(12), left: -px(12), right: -px(12), bottom: -px(12), borderRadius: radius === 999 ? 999 : r + px(12), borderWidth: px(6), borderColor: C.focusSoft }}>
          <View style={{ flex: 1, borderRadius: radius === 999 ? 999 : r + px(6), borderWidth: px(6), borderColor: C.focus }} />
        </View>
      )}
      {children}
    </Pressable>
  );
}

export function Avatar({ color, initial, size = 56, font = 30, ring }){
  return (
    <View style={sx({ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }, ring ? { borderWidth: 3, borderColor: ring } : null)}>
      <Txt head style={{ fontSize: font, fontWeight: '700', color: C.inkDark, lineHeight: font * 1.15 }}>{initial}</Txt>
    </View>
  );
}

export function Pill({ bg, fg = C.inkDark, size = 18, padH = 14, padV = 5, children, style }){
  return (
    <View style={sx({ backgroundColor: bg, borderRadius: 999, paddingHorizontal: padH, paddingVertical: padV }, style)}>
      <Txt style={{ fontSize: size, fontWeight: '800', color: fg }}>{children}</Txt>
    </View>
  );
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Pips({ value, size, pad, color = C.pip }){
  const on = PIPS[value] || [];
  return (
    <View style={{ flex: 1, padding: px(pad), justifyContent: 'space-between' }}>
      {[0, 1, 2].map(r => (
        <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[0, 1, 2].map(c => (
            <View key={c} style={{ width: px(size), height: px(size), borderRadius: px(size / 2), backgroundColor: color, opacity: on.includes(r * 3 + c) ? 1 : 0 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// A die. `rollKey` changes on each new roll; non-held dice tumble unless reduced motion is on.
export function Die({ value, size = 104, radius = 24, pipSize = 17, pad = 16, ring, held, lift = 0, rollKey, reduced, pipColor, rotate = 0 }){
  const anim = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced || held || !rollKey) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [rollKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const spin = anim.interpolate({ inputRange: [0, 1], outputRange: [(rollKey % 2 ? '-200deg' : '200deg'), rotate + 'deg'] });
  const scale = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 1.08, 1] });
  return (
    <Animated.View style={{ transform: [{ translateY: -px(lift) }, { rotate: spin }, { scale }] }}>
      <View style={{ width: px(size), height: px(size), borderRadius: px(radius), backgroundColor: '#F6EAD6', borderWidth: px(ring ? 5 : 0), borderColor: ring || 'transparent', borderBottomWidth: px(ring ? 5 : 6), borderBottomColor: ring || '#DCC9AA', overflow: 'hidden' }}>
        <Pips value={value} size={pipSize} pad={pad - (ring ? 5 : 0)} color={pipColor} />
      </View>
    </Animated.View>
  );
}

export function Narrator({ tag, text, reduced }){
  const a = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { a.setValue(1); return; }
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 350, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start();
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  return (
    <Animated.View style={[sx({ flexDirection: 'row', gap: 14, alignItems: 'flex-start', backgroundColor: C.ink, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 20 }), { opacity: a, transform: [{ scale }] }]}>
      <Txt style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, color: '#8A7A6A', marginTop: 6 }}>{tag.toUpperCase()}</Txt>
      <Txt style={{ flex: 1, fontSize: 22, fontWeight: '700', lineHeight: 29, color: C.inkDark }}>{text}</Txt>
    </Animated.View>
  );
}

// Real QR code for `value`, drawn with Views (one View per run of dark modules in a row).
export function QR({ value, size = 300, color = C.inkDark }){
  const rows = useMemo(() => {
    if (!value) return { n: 0, runs: [] };
    const q = qrcode(0, 'M'); q.addData(value); q.make();
    const n = q.getModuleCount(); const runs = [];
    for (let r = 0; r < n; r++) {
      const row = []; let start = -1;
      for (let c = 0; c <= n; c++) {
        const dark = c < n && q.isDark(r, c);
        if (dark && start < 0) start = c;
        if (!dark && start >= 0) { row.push([start, c - start]); start = -1; }
      }
      runs.push(row);
    }
    return { n, runs };
  }, [value]);
  if (!rows.n) return <View style={{ width: px(size), height: px(size) }} />;
  const cell = Math.floor(px(size) / rows.n);
  const total = cell * rows.n;
  return (
    <View style={{ width: px(size), height: px(size), alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: total, height: total }}>
        {rows.runs.map((row, r) => row.map(([c, len]) => (
          <View key={r + '-' + c} style={{ position: 'absolute', top: r * cell, left: c * cell, width: len * cell, height: cell, backgroundColor: color }} />
        )))}
      </View>
    </View>
  );
}
