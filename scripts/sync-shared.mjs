// Copies shared/ into every consumer.
//   shared/engine.js, shared/i18n.js           → backend/shared/, tv/src/shared/
//   shared/dice3d/motion-engine.js             → backend/shared/ too, wrapped as an ES module (the phone imports
//                                                ShakeDetector from it; a bare `module` reference would make Vite's
//                                                build treat the whole bundle as CommonJS)
//   shared/dice3d/{index.html, motion-engine.js, three.classic.js}
//                                              → backend/public/dice3d/ (served at /dice3d/), tv/assets/dice3d/
// .js files we own get a GENERATED header line; three.classic.js (vendored Three.js) and index.html are copied
// byte-identical. prototype.html is never copied. Missing dice3d files are skipped.
// Usage: node scripts/sync-shared.mjs            → all targets
//        node scripts/sync-shared.mjs backend    → only the targets whose name is listed
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEADER = '// GENERATED from shared/ — edit there and run node scripts/sync-shared.mjs\n';
const VERBATIM = new Set(['dice3d/three.classic.js', 'dice3d/index.html']);
const DICE3D = ['dice3d/index.html', 'dice3d/motion-engine.js', 'dice3d/three.classic.js'];
// target name → [[source relative to shared/, destination dir relative to repo root], ...]
const TARGETS = {
  backend: [
    ['engine.js', 'backend/shared'], ['i18n.js', 'backend/shared'], ['dice3d/motion-engine.js', 'backend/shared', 'esm'],
    ...DICE3D.map(f => [f, 'backend/public/dice3d']),
  ],
  tv: [['engine.js', 'tv/src/shared'], ['i18n.js', 'tv/src/shared'], ...DICE3D.map(f => [f, 'tv/assets/dice3d'])],
};

const only = process.argv.slice(2);
for (const [name, list] of Object.entries(TARGETS)) {
  if (only.length && !only.includes(name)) continue;
  for (const [src, dir, wrap] of list) {
    const from = join(root, 'shared', src);
    if (!existsSync(from)) { console.log(`shared/${src} missing, skipped`); continue; }
    const file = src.split('/').pop();
    mkdirSync(join(root, dir), { recursive: true });
    const buf = readFileSync(from);
    const out = VERBATIM.has(src) ? buf
      : wrap === 'esm' ? HEADER + 'const module = { exports: {} };\n' + buf.toString('utf8') + '\nexport const { ShakeDetector, DiceMotion } = module.exports;\nexport default module.exports;\n'
      : HEADER + buf.toString('utf8');
    writeFileSync(join(root, dir, file), out);
    console.log(`shared/${src} → ${dir}/${file}`);
  }
}
