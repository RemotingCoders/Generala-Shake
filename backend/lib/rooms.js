// Room service: the only writer of game state. Every action is validated by the shared engine,
// dice are rolled with crypto RNG, and writes use seq-based optimistic concurrency.
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import * as E from '../shared/engine.js';
import { getStore } from './store.js';
import { fail, statusOf } from './http.js';
import { publicUrl } from './config.js';

const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_TTL = 4 * 3600e3;
export const CONNECTED_MS = 35000;
const MAX_EVENTS = 10, MAX_RETRIES = 5;
const MODES = ['turns', 'simul'], LENGTHS = ['short', 'full'];

const rng = () => randomInt(0, 2 ** 47) / 2 ** 47; // uniform in [0,1) from crypto
const newCode = () => Array.from({ length: 4 }, () => LETTERS[randomInt(LETTERS.length)]).join('');
const token = () => randomUUID();
function sameToken(a, b){
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function codeOf(raw){ const c = String(raw || '').toUpperCase(); if (!/^[A-Z]{4}$/.test(c)) fail(404, 'notfound'); return c; }
const refreshConnected = (s, now) => ({ ...s, players: s.players.map(p => ({ ...p, connected: now - (p.lastSeen || 0) < CONNECTED_MS })) });
const touch = (s, pid, now) => ({ ...s, players: s.players.map(p => p.id === pid ? { ...p, lastSeen: now } : p) });

// game options from a request body; `partial` keeps only the fields present (rematch overrides)
function options(body, partial){
  const o = {};
  if (body.variant !== undefined || !partial) { if (!E.VARIANTS[body.variant]) fail(400, 'badRequest'); o.variant = body.variant; }
  if (body.mode !== undefined || !partial) { if (!MODES.includes(body.mode)) fail(400, 'badRequest'); o.mode = body.mode; }
  if (body.narrator !== undefined) { if (typeof body.narrator !== 'boolean') fail(400, 'badRequest'); o.narrator = body.narrator; }
  if (body.demoLength !== undefined) { if (!LENGTHS.includes(body.demoLength)) fail(400, 'badRequest'); o.demoLength = body.demoLength; }
  else if (!partial) o.demoLength = 'full';
  return o;
}

async function load(code){
  const row = await getStore().get(code);
  if (!row) fail(404, 'notfound');
  if (row.state.expiresAt < Date.now()) fail(410, 'expired');
  return row.state;
}

// Applies fn(state, now) → { state, events } | { error } | { noop: true } and stores it, retrying on seq conflicts.
async function mutate(code, fn, actorId){
  for (let i = 0; i < MAX_RETRIES; i++) {
    const prev = await load(code); const now = Date.now();
    const r = fn(prev, now);
    if (r.error) fail(statusOf(r.error), r.error);
    if (r.noop) return refreshConnected(prev, now);
    let next = { ...r.state, seq: prev.seq + 1 };
    if (actorId) next = touch(next, actorId, now);
    next = refreshConnected(next, now);
    if (r.events && r.events.length) {
      let id = prev.lastEventId || 0;
      const evs = r.events.map(ev => ({ ...ev, id: ++id, ts: now, round: ev.round ?? prev.round, variant: next.variant }));
      next.events = [...(next.events || []), ...evs].slice(-MAX_EVENTS);
      next.lastEventId = id;
    }
    if (await getStore().update(code, prev.seq, next)) return next;
  }
  fail(409, 'busy');
}

export async function createRoom(body, req){
  const opts = options(body, false);
  const now = Date.now();
  const base = { ...E.newGame(opts), createdAt: now, expiresAt: now + ROOM_TTL, events: [], lastEventId: 0 };
  for (let i = 0; i < 20; i++) {
    const code = newCode(), hostToken = token();
    const state = { ...base, roomCode: code };
    if (await getStore().create(code, state, hostToken)) {
      return { status: 201, body: { code, hostToken, joinUrl: `${publicUrl(req)}/?room=${code}`, state } };
    }
  }
  fail(409, 'busy');
}

export async function getRoom(rawCode){
  const state = await load(codeOf(rawCode));
  return { body: { state: refreshConnected(state, Date.now()) } };
}

export async function joinRoom(rawCode, body){
  const code = codeOf(rawCode);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 14) : '';
  const color = typeof body.color === 'string' ? body.color : null;
  const current = await load(code);
  const secrets = await getStore().getSecrets(code);
  if (!secrets) fail(404, 'notfound');
  let playerId = typeof body.playerToken === 'string' ? secrets.playerTokens[body.playerToken] : null;
  let playerToken = playerId ? body.playerToken : null;
  if (!playerId) {
    // fail fast before minting a token for a join that can't succeed
    if (current.closed) fail(409, 'closed');
    if (current.phase !== 'lobby') fail(409, 'started');
    if (current.players.length >= E.MAX_PLAYERS) fail(409, 'full');
    if (!name) fail(400, 'badRequest');
    playerId = 'p_' + randomUUID().slice(0, 8); playerToken = token();
    await getStore().addPlayerToken(code, playerToken, playerId);
  }
  const state = await mutate(code, s => {
    const known = s.players.some(p => p.id === playerId);
    if (!known && !name) return { error: 'badRequest' };
    const taken = s.players.filter(p => p.id !== playerId).map(p => p.color);
    const pick = color && E.COLORS.includes(color) && !taken.includes(color) ? color : E.COLORS.find(c => !taken.includes(c));
    const r = E.joinPlayer(s, { id: playerId, name, color: pick });
    return r.error ? r : { state: r.state };
  }, playerId);
  return { body: { playerId, playerToken, state } };
}

const HOST_ACTIONS = {
  start: s => s.phase !== 'lobby' ? { error: 'badRequest' } : E.startGame(s),
  pause: s => s.phase !== 'playing' ? { error: 'notPlaying' } : s.paused ? { noop: true } : { state: { ...s, paused: true } },
  resume: s => s.phase !== 'playing' ? { error: 'notPlaying' } : !s.paused ? { noop: true } : { state: { ...s, paused: false } },
  end: s => s.phase !== 'playing' ? { error: 'notPlaying' } : E.endNow(s),
  // optional overrides (variant, mode, narrator, demoLength) let the host change the rules and keep the players
  rematch: (s, now, overrides) => {
    if (s.phase === 'playing') return { error: 'badRequest' };
    const g = E.rematch(s, overrides);
    return { state: { ...g, createdAt: s.createdAt, expiresAt: now + ROOM_TTL, events: [], lastEventId: s.lastEventId || 0 } };
  },
  close: s => s.closed ? { noop: true } : { state: { ...s, closed: true } },
};

export async function hostAction(rawCode, body){
  const code = codeOf(rawCode);
  await load(code);
  const secrets = await getStore().getSecrets(code);
  if (!secrets || !sameToken(body.hostToken, secrets.hostToken)) fail(401, 'unauthorized');
  const act = HOST_ACTIONS[body.action];
  if (!act) fail(400, 'badRequest');
  const overrides = body.action === 'rematch' ? options(body, true) : null;
  const state = await mutate(code, (s, now) => (s.closed && body.action !== 'close') ? { error: 'closed' } : act(s, now, overrides));
  return { body: { state } };
}

export async function playAction(rawCode, body){
  const code = codeOf(rawCode);
  await load(code);
  const secrets = await getStore().getSecrets(code);
  const pid = secrets && typeof body.playerToken === 'string' ? secrets.playerTokens[body.playerToken] : null;
  if (!pid) fail(401, 'unauthorized');
  const { action } = body;
  if (action === 'hold' && !(Number.isInteger(body.index) && body.index >= 0 && body.index < 5)) fail(400, 'badRequest');
  if (action === 'choose' && typeof body.cat !== 'string') fail(400, 'badRequest');
  if (action === 'shake' && typeof body.active !== 'boolean') fail(400, 'badRequest');
  const fn = (s, now) => {
    if (!s.players.some(p => p.id === pid)) return { error: 'unauthorized' };
    if (s.closed) return action === 'ping' || action === 'leave' ? { noop: true } : { error: 'closed' };
    switch (action) {
      case 'roll': return E.rollDice(s, pid, rng, now);
      case 'shake': return E.setShaking(s, pid, body.active, now); // live shake on/off, no narrator event
      case 'hold': return E.toggleHold(s, pid, body.index);
      case 'choose': return E.chooseCategory(s, pid, body.cat);
      case 'ping': return { state: s };
      case 'leave': return s.phase === 'lobby'
        ? { state: { ...s, players: s.players.filter(p => p.id !== pid) } }
        : { state: { ...s, players: s.players.map(p => p.id === pid ? { ...p, lastSeen: 0 } : p) } };
      default: return { error: 'badRequest' };
    }
  };
  const state = await mutate(code, fn, action === 'leave' ? null : pid);
  return { body: { state } };
}
