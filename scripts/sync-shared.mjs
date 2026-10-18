// Copies shared/engine.js and shared/i18n.js into every consumer (backend/shared, tv/src/shared).
// Usage: node scripts/sync-shared.mjs            → all targets
//        node scripts/sync-shared.mjs backend    → only the targets whose name is listed
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['engine.js', 'i18n.js'];
const TARGETS = { backend: 'backend/shared', tv: 'tv/src/shared' };
const HEADER = '// GENERATED from shared/ — edit there and run node scripts/sync-shared.mjs\n';

const only = process.argv.slice(2);
for (const [name, dir] of Object.entries(TARGETS)) {
  if (only.length && !only.includes(name)) continue;
  mkdirSync(join(root, dir), { recursive: true });
  for (const f of FILES) {
    writeFileSync(join(root, dir, f), HEADER + readFileSync(join(root, 'shared', f), 'utf8'));
    console.log(`shared/${f} → ${dir}/${f}`);
  }
}
