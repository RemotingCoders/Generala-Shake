// The design canvas is 1280x720 (backend/src/GeneralaTV.jsx). Fire TV renders 1920x1080, so every
// length in the design is multiplied by K = min(width/1280, height/720) (1.5 on a 1080p screen).
// Scaling lengths (instead of a transform on the root) keeps text crisp and focus geometry exact.
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
export const K = Math.min(width / 1280, height / 720) || 1;
export const SCREEN = { width, height };

export const px = (n) => Math.round(n * K * 100) / 100;

const SCALED = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'top', 'left', 'right', 'bottom',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical',
  'borderWidth', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  'fontSize', 'lineHeight', 'letterSpacing', 'gap', 'rowGap', 'columnGap', 'flexBasis',
]);

// sx({ width: 104, padding: 16 }) → lengths scaled by K. Arrays/falsy entries are flattened like RN styles.
export function sx(...styles){
  const out = {};
  for (const st of styles) {
    if (!st) continue;
    if (Array.isArray(st)) { Object.assign(out, sx(...st)); continue; }
    for (const k in st) {
      const v = st[k];
      out[k] = (typeof v === 'number' && SCALED.has(k)) ? px(v) : v;
    }
  }
  return out;
}

// Like StyleSheet.create but scaled; values are plain objects (fine for RN styles).
export function scaled(defs){
  const out = {};
  for (const k in defs) out[k] = sx(defs[k]);
  return out;
}
