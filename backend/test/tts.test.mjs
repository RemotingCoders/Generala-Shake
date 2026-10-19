import test from 'node:test';
import assert from 'node:assert/strict';
import { narratorText } from '../lib/tts.js';
import { narratorLine, NARRATOR } from '../shared/i18n.js';
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

test('narrator variants: v picks the template, out-of-range v is rejected, TV and server agree on the pick', () => {
  assert.equal(narratorText({ lang: 'es', k: 'full', v: '1', name: 'Ana', score: '30' }), NARRATOR.es.full[1].replace('{name}', 'Ana').replace('{score}', '30'));
  assert.throws(() => narratorText({ lang: 'es', k: 'full', v: '8', name: 'Ana', score: '30' }), e => e.code === 'badRequest');
  const g = { roomCode: 'ABCD', variant: 'generala', players: [{ id: 'a', name: 'Ana' }] };
  const seen = new Set();
  for (let id = 1; id <= 40; id++) { const l = narratorLine('es', g, { id, type: 'score', pid: 'a', cat: 'full', score: 30 }); seen.add(l.v); assert.equal(l.text, narratorText({ lang: 'es', k: l.k, v: l.v, ...l.vars })); }
  assert.ok(seen.size >= 6, 'events spread over the variants: ' + [...seen]);
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

test('a narrator event pre-generates its audio in the background; /api/tts then serves it from the cache', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.openai.com/')) { calls.push(JSON.parse(init.body).input); await new Promise(r => setTimeout(r, 30)); return new Response(Buffer.from('ID3fake-' + calls.length), { status: 200 }); }
    return realFetch(url, init);
  };
  try {
    const { createRoom, joinRoom, hostAction, playAction } = await import('../lib/rooms.js');
    const room = (await createRoom({ variant: 'generala', mode: 'turns', narrator: true, demoLength: 'short' }, { headers: { host: 'x' } })).body;
    const a = (await joinRoom(room.code, { name: 'Tita', color: '#E8603C' })).body;
    await joinRoom(room.code, { name: 'Pocho', color: '#2A9D8F' });
    await hostAction(room.code, { hostToken: room.hostToken, action: 'start' });
    await playAction(room.code, { playerToken: a.playerToken, action: 'roll' });
    const st = (await playAction(room.code, { playerToken: a.playerToken, action: 'choose', cat: 'generala' })).body.state; // scratch → "zero" line
    await new Promise(r => setTimeout(r, 150));                                                     // background job done
    const ev = st.events[st.events.length - 1], es = narratorLine('es', st, ev), en = narratorLine('en', st, ev);
    assert.equal(es.k, 'zero'); assert.equal(es.v, en.v);
    assert.deepEqual(calls.sort(), [en.text, es.text].sort());
    const res = await new Promise(resolve => {
      const r = { headers: {}, setHeader(k, v){ this.headers[k] = v; }, end(b){ resolve({ status: this.statusCode, type: this.headers['Content-Type'], body: String(b) }); } };
      handleApi({ method: 'GET', url: `/api/tts?lang=es&k=zero&v=${es.v}&name=Tita&cat=Generala`, headers: {} }, r);
    });
    assert.equal(res.status, 200); assert.equal(res.type, 'audio/mpeg'); assert.match(res.body, /^ID3fake-/);
    assert.equal(calls.length, 2, 'served from cache, no new OpenAI call');
  } finally { globalThis.fetch = realFetch; delete process.env.OPENAI_API_KEY; }
});
