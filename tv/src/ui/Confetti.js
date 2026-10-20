// Falling confetti for the results screen: paper pieces drop from above the screen, swaying and spinning, in a
// native-driver Animated loop (one timing per piece, staggered). With reduced motion the pieces are drawn still,
// scattered over the screen, like the original static confetti.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { SCREEN, px } from './scale';

const COLORS = ['#E8603C', '#2A9D8F', '#E9B44C', '#7B6CF6', '#FFF3DF'];
// deterministic layout: left (%), size, spin direction, fall time and start delay per piece
const PIECES = Array.from({ length: 30 }, (_, i) => ({
  left: (i * 37 + 11) % 100, top: (i * 53) % 92,
  w: 10 + (i % 3) * 4, h: 14 + (i % 4) * 4,
  color: COLORS[i % COLORS.length],
  dir: i % 2 ? 1 : -1, sway: 24 + (i % 4) * 14,
  duration: 4200 + (i % 6) * 650, delay: (i * 230) % 2600,
}));

function Piece({ p, reduced }){
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(p.delay),
      Animated.timing(a, { toValue: 1, duration: p.duration, easing: Easing.linear, useNativeDriver: true }),
    ]), { resetBeforeIteration: true });
    loop.start();
    return () => loop.stop();
  }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  if (reduced) {
    return <View style={{ position: 'absolute', left: p.left + '%', top: p.top + '%', width: px(p.w), height: px(p.h), borderRadius: px(3), backgroundColor: p.color, opacity: 0.35, transform: [{ rotate: ((p.left * 7) % 180) + 'deg' }] }} />;
  }
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [-px(40), SCREEN.height + px(40)] });
  const translateX = a.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, px(p.sway) * p.dir, 0, -px(p.sway) * p.dir, 0] });
  const rotate = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', (p.dir * (540 + (p.w % 3) * 180)) + 'deg'] });
  return (
    <Animated.View style={{ position: 'absolute', left: p.left + '%', top: 0, width: px(p.w), height: px(p.h), borderRadius: px(3), backgroundColor: p.color, opacity: 0.9, transform: [{ translateY }, { translateX }, { rotate }] }} />
  );
}

export function Confetti({ reduced }){
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: SCREEN.width, height: SCREEN.height, overflow: 'hidden' }}>
      {PIECES.map((p, i) => <Piece key={i} p={p} reduced={reduced} />)}
    </View>
  );
}
