// API tests: real HTTP against the same handlers Vercel deploys, backed by the in-memory store.
// Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as E from '../shared/engine.js';
import { handleApi } from '../lib/router.js';
import { getStore, memoryStore, setStore } from '../lib/store.js';

delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
setStore(memoryStore());

let server, base;
before(async () => {
  server = http.createServer((req, res) => handleApi(req, res).then(h => { if (!h) { res.statusCode = 404; res.end(); } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, body){
  const r = await fetch(base + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null, headers: r.headers };
}
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; };

async function room(opts = {}){
  return ok(await call('POST', '/api/rooms', { variant: 'generala', mode: 'turns', narrator: true, demoLength: 'full', ...opts }), 201);
}
async function join(code, name, extra = {}){ return call('POST', `/api/rooms/${code}/join`, { name, color: E.COLORS[0], ...extra }); }
const host = (code, hostToken, action, extra = {}) => call('POST', `/api/rooms/${code}/host`, { hostToken, action, ...extra });
const play = (code, playerToken, action, extra = {}) => call('POST', `/api/rooms/${code}/play`, { playerToken, action, ...extra });

// Watches every state the server returns: seq strictly grows, event ids strictly grow, no tokens leak.
function tracker(secrets){
  let seq = -1, ev = 0;
  return state => {
    assert.ok(state.seq >= seq, `seq ${state.seq} after ${seq}`); seq = state.seq;
    assert.ok(state.events.length <= 10);
    for (const e of state.events) assert.ok(typeof e.id === 'number' && e.variant === state.variant);
    const ids = state.events.map(e => e.id); assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
    if (ids.length) { assert.ok(ids[ids.length - 1] >= ev); ev = ids[ids.length - 1]; }
    const json = JSON.stringify(state); for (const s of secrets) assert.ok(!json.includes(s), 'token leaked into state');
    return state;
  };
}

// One player's turn: roll, keep the most common value, reroll up to twice, score the best box.
async function fullTurn(code, tok, pid, see, rolled){
  let s = rolled || see(ok(await play(code, tok, 'roll')).state);
  const hand = () => s.mode === 'turns' ? s.hand : s.hands[pid];
  for (let k = 0; k < 2; k++) {
    const d = hand().dice; const c = [0,0,0,0,0,0,0]; d.forEach(v => c[v]++);
    const best = c.indexOf(Math.max(...c));
    for (let i = 0; i < 5; i++) if (hand().held[i] !== (d[i] === best)) s = see(ok(await play(code, tok, 'hold', { index: i })).state);
    s = see(ok(await play(code, tok, 'roll')).state);
  }
  assert.equal(hand().rollsLeft, 0);
  const no = await play(code, tok, 'roll'); assert.equal(no.status, 409); assert.equal(no.data.error, 'noRolls');
  const pot = E.handPotential(s, pid);
  const cats = E.VARIANTS[s.variant].cats.filter(c => pot.scores[c] !== null && pot.scores[c] !== undefined);
  const cat = cats.reduce((a, b) => pot.scores[b] > pot.scores[a] ? b : a, cats[0]);
  const bad = E.VARIANTS[s.variant].cats.find(c => pot.scores[c] === null);
  if (bad) { const r = await play(code, tok, 'choose', { cat: bad }); assert.equal(r.data.error, 'categoryUnavailable'); }
  return see(ok(await play(code, tok, 'choose', { cat })).state);
}

test('CORS + preflight + config', async () => {
  const pre = await fetch(base + '/api/rooms', { method: 'OPTIONS' });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  const cfg = await call('GET', '/api/config');
  assert.equal(cfg.headers.get('access-control-allow-origin'), '*');
  assert.equal(cfg.data.realtime, false); assert.match(cfg.data.publicUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal((await call('POST', '/api/rooms', { variant: 'chess', mode: 'turns' })).data.error, 'badRequest');
  assert.equal((await call('GET', '/api/rooms/ZZZZ')).status, 404);
  assert.equal((await call('GET', '/api/rooms/ZZZZ')).data.error, 'notfound');
});

test('generala, turns: full game to results', async () => {
  const r = await room({ variant: 'generala', mode: 'turns' });
  assert.match(r.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/); assert.equal(r.joinUrl.endsWith('/?room=' + r.code), true);
  const a = ok(await join(r.code, 'Ana')); const b = ok(await join(r.code, 'Beto', { color: E.COLORS[0] }));
  assert.notEqual(a.state.players[0].color, b.state.players[1].color, 'taken color is reassigned');
  assert.equal(b.state.players[1].color, E.COLORS[1]);
  assert.ok(b.state.players.every(p => p.lastSeen > 0 && p.connected));
  const see = tracker([r.hostToken, a.playerToken, b.playerToken]);
  see(b.state);
  assert.equal((await host(r.code, r.hostToken, 'start')).status, 200);
  const toks = { [a.playerId]: a.playerToken, [b.playerId]: b.playerToken };
  let s = see(ok(await call('GET', `/api/rooms/${r.code}`)).state);
  assert.equal(s.phase, 'playing');
  // the player who isn't active can't roll
  const idle = s.players.find((p, i) => i !== s.activeIdx);
  assert.equal((await play(r.code, toks[idle.id], 'roll')).data.error, 'notYourTurn');
  assert.equal((await play(r.code, toks[s.players[s.activeIdx].id], 'hold', { index: 0 })).data.error, 'rollFirst');
  let turns = 0;
  while (s.phase === 'playing') { const pid = s.players[s.activeIdx].id; s = await fullTurn(r.code, toks[pid], pid, see); turns++; }
  assert.equal(s.phase, 'results'); assert.ok(s.winnerIds.length >= 1);
  assert.ok(turns === 22 || s.endReason === 'servida', `turns ${turns}`);
  assert.ok(s.events.some(e => e.type === 'end' || e.type === 'servidaWin'));
  // rematch keeps players, resets sheets, seq keeps growing
  const m = see(ok(await host(r.code, r.hostToken, 'rematch', { variant: 'yahtzee' })).state);
  assert.equal(m.phase, 'lobby'); assert.equal(m.variant, 'yahtzee'); assert.equal(m.players.length, 2);
  assert.deepEqual(m.players[0].sheet, {}); assert.equal(m.events.length, 0);
});

test('yahtzee, simultaneous: full game to results', async () => {
  const r = await room({ variant: 'yahtzee', mode: 'simul', demoLength: 'full' });
  const ps = []; for (const n of ['Ana', 'Beto', 'Caro']) ps.push(ok(await join(r.code, n)));
  const see = tracker([r.hostToken, ...ps.map(p => p.playerToken)]);
  let s = see(ok(await host(r.code, r.hostToken, 'start')).state);
  let rounds = 0;
  while (s.phase === 'playing') {
    const round = s.round;
    // everybody rolls first, then they score (interleaved like real phones)
    for (const p of ps) s = see(ok(await play(r.code, p.playerToken, 'roll')).state);
    for (const p of ps) {
      s = see(ok(await call('GET', `/api/rooms/${r.code}`)).state);
      s = await fullTurn(r.code, p.playerToken, p.playerId, see, s);
      if (s.phase === 'playing' && s.round === round) assert.equal((await play(r.code, p.playerToken, 'roll')).data.error, 'alreadyDone');
    }
    rounds++;
  }
  assert.equal(rounds, 13); assert.equal(s.phase, 'results');
  assert.ok(s.players.every(p => Object.keys(p.sheet).length === 13));
  assert.equal(s.events[s.events.length - 1].type, 'end');
});

test('auth failures and host controls', async () => {
  const r = await room();
  const a = ok(await join(r.code, 'Ana')); ok(await join(r.code, 'Beto'));
  const bad = await host(r.code, 'nope', 'start'); assert.equal(bad.status, 401); assert.equal(bad.data.error, 'unauthorized');
  assert.equal((await host(r.code, a.playerToken, 'start')).data.error, 'unauthorized');
  assert.equal((await play(r.code, r.hostToken, 'roll')).data.error, 'unauthorized');
  assert.equal((await play(r.code, 'x', 'ping')).status, 401);
  assert.equal((await host(r.code, r.hostToken, 'dance')).data.error, 'badRequest');
  assert.equal((await host(r.code, r.hostToken, 'pause')).data.error, 'notPlaying');
  ok(await host(r.code, r.hostToken, 'start'));
  assert.equal(ok(await host(r.code, r.hostToken, 'pause')).state.paused, true);
  assert.equal((await play(r.code, a.playerToken, 'roll')).data.error, 'notPlaying');
  assert.equal(ok(await host(r.code, r.hostToken, 'resume')).state.paused, false);
  const end = ok(await host(r.code, r.hostToken, 'end')).state;
  assert.equal(end.phase, 'results'); assert.equal(end.events[end.events.length - 1].type, 'end');
  const closed = ok(await host(r.code, r.hostToken, 'close')).state; assert.equal(closed.closed, true);
  assert.equal((await join(r.code, 'Late')).data.error, 'closed');
  assert.equal((await play(r.code, a.playerToken, 'roll')).data.error, 'closed');
});

test('rejoin with token keeps playerId; join after start; full room; ping/leave', async () => {
  const r = await room();
  const ps = []; for (const n of ['A', 'B', 'C', 'D']) ps.push(ok(await join(r.code, n)));
  const fifth = await join(r.code, 'E'); assert.equal(fifth.status, 409); assert.equal(fifth.data.error, 'full');
  assert.equal(new Set(ps[3].state.players.map(p => p.color)).size, 4);
  // leave in the lobby frees the seat
  const left = ok(await play(r.code, ps[3].playerToken, 'leave')).state; assert.equal(left.players.length, 3);
  const again = ok(await join(r.code, 'D2')); assert.equal(again.state.players.length, 4);
  ok(await host(r.code, r.hostToken, 'start'));
  const late = await join(r.code, 'Late'); assert.equal(late.status, 409); assert.equal(late.data.error, 'started');
  const re = ok(await join(r.code, 'whatever', { playerToken: ps[1].playerToken }));
  assert.equal(re.playerId, ps[1].playerId); assert.equal(re.playerToken, ps[1].playerToken);
  assert.equal(re.state.players.length, 4); assert.equal(re.state.players.find(p => p.id === re.playerId).name, 'B');
  // leaving mid-game marks the player disconnected, ping brings them back
  const gone = ok(await play(r.code, ps[0].playerToken, 'leave')).state;
  assert.equal(gone.players.find(p => p.id === ps[0].playerId).connected, false);
  const back = ok(await play(r.code, ps[0].playerToken, 'ping')).state;
  assert.equal(back.players.find(p => p.id === ps[0].playerId).connected, true);
});

test('expired room → 410', async () => {
  const r = await room();
  const a = ok(await join(r.code, 'Ana'));
  const store = getStore(); const row = await store.get(r.code);
  assert.ok(await store.update(r.code, row.state.seq, { ...row.state, expiresAt: Date.now() - 1 }));
  for (const res of [await call('GET', `/api/rooms/${r.code}`), await join(r.code, 'Beto'), await play(r.code, a.playerToken, 'ping'), await host(r.code, r.hostToken, 'start')]) {
    assert.equal(res.status, 410); assert.equal(res.data.error, 'expired');
  }
});

test('concurrent joins all land (optimistic concurrency + retry)', async () => {
  const r = await room();
  const res = await Promise.all(['A', 'B', 'C', 'D'].map(n => join(r.code, n)));
  assert.ok(res.every(x => x.status === 200));
  const s = ok(await call('GET', `/api/rooms/${r.code}`)).state;
  assert.equal(s.players.length, 4);
  for (const x of res) assert.equal((await play(r.code, x.data.playerToken, 'ping')).status, 200);
});
