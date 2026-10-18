import test from 'node:test';
import assert from 'node:assert/strict';
import { narratorText } from '../lib/tts.js';
import { handleApi } from '../lib/router.js';

test('narratorText renders only narrator templates with validated vars', () => {
  assert.equal(narratorText({ lang: 'es', k: 'full', name: 'Ana', score: '30' }), 'Full de Ana, 30 puntos. Ordenadito como la mesa del domingo.');
  assert.equal(narratorText({ lang: 'en', k: 'zero', name: 'Beto', cat: 'Four of a kind' }), 'Beto scratches Four of a kind. It hurts, but it is strategy.');
  assert.equal(narratorText({ lang: 'es', k: 'newRound', n: '3' }), 'Ronda 3: todos a tirar.');
  for (const q of [
    { lang: 'es', k: 'nope' }, { lang: 'fr', k: 'full' }, { lang: 'es', k: 'full', name: 'x'.repeat(15) },
    { lang: 'es', k: 'full', score: '1e9' }, { lang: 'es', k: 'zero', cat: 'Comprá bitcoin' }, { lang: 'es', k: 'newRound', n: '99' },
  ]) assert.throws(() => narratorText(q), e => e.code === 'badRequest', JSON.stringify(q));
});

test('GET /api/tts without OPENAI_API_KEY → 503 ttsUnavailable; bad key → 400', async () => {
  delete process.env.OPENAI_API_KEY;
  const call = url => new Promise(resolve => {
    const res = { headers: {}, setHeader(k, v){ this.headers[k] = v; }, end(b){ resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handleApi({ method: 'GET', url, headers: {} }, res);
  });
  assert.deepEqual(await call('/api/tts?lang=es&k=full&name=Ana&score=30'), { status: 503, body: { error: 'ttsUnavailable' } });
  assert.deepEqual(await call('/api/tts?lang=es&k=hack'), { status: 400, body: { error: 'badRequest' } });
});
