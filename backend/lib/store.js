// Room storage. Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, otherwise an in-memory map
// (local development and tests only: it lives in one process and is lost on restart).
//
// Interface (all async):
//   create(code, state, hostToken) → false if a live room already uses the code
//   get(code)                       → { state } | null
//   update(code, oldSeq, state)     → true if the row still had oldSeq (optimistic concurrency)
//   getSecrets(code)                → { hostToken, playerTokens: { token: playerId } } | null
//   addPlayerToken(code, token, playerId)
import { createClient } from '@supabase/supabase-js';

const clone = v => structuredClone(v);

export function memoryStore(){
  const rooms = new Map();
  const sweep = () => { const now = Date.now(); for (const [k, r] of rooms) if (r.state.expiresAt < now - 3600e3) rooms.delete(k); };
  return {
    kind: 'memory',
    async create(code, state, hostToken){
      sweep();
      const old = rooms.get(code);
      if (old && old.state.expiresAt > Date.now()) return false;
      rooms.set(code, { state: clone(state), secrets: { hostToken, playerTokens: {} } });
      return true;
    },
    async get(code){ const r = rooms.get(code); return r ? { state: clone(r.state) } : null; },
    async update(code, oldSeq, state){
      const r = rooms.get(code);
      if (!r || r.state.seq !== oldSeq) return false;
      r.state = clone(state); return true;
    },
    async getSecrets(code){ const r = rooms.get(code); return r ? clone(r.secrets) : null; },
    async addPlayerToken(code, token, playerId){ const r = rooms.get(code); if (r) r.secrets.playerTokens[token] = playerId; },
  };
}

export function supabaseStore(url, serviceKey){
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = ({ error }) => { if (error) throw new Error('supabase: ' + error.message); };
  return {
    kind: 'supabase',
    async create(code, state, hostToken){
      check(await db.from('rooms').delete().eq('code', code).lt('expires_at', new Date().toISOString()));
      const ins = await db.from('rooms').insert({ code, state, seq: state.seq, expires_at: new Date(state.expiresAt).toISOString() });
      if (ins.error && ins.error.code === '23505') return false; // unique violation: live room with this code
      check(ins);
      check(await db.from('room_secrets').insert({ code, host_token: hostToken, player_tokens: {} }));
      return true;
    },
    async get(code){
      const r = await db.from('rooms').select('state').eq('code', code).maybeSingle(); check(r);
      return r.data ? { state: r.data.state } : null;
    },
    async update(code, oldSeq, state){
      const r = await db.from('rooms').update({ state, seq: state.seq, updated_at: new Date().toISOString(), expires_at: new Date(state.expiresAt).toISOString() })
        .eq('code', code).eq('seq', oldSeq).select('code');
      check(r); return r.data.length > 0;
    },
    async getSecrets(code){
      const r = await db.from('room_secrets').select('host_token, player_tokens').eq('code', code).maybeSingle(); check(r);
      return r.data ? { hostToken: r.data.host_token, playerTokens: r.data.player_tokens || {} } : null;
    },
    // atomic jsonb merge (see supabase/schema.sql) so two simultaneous joins can't drop each other's token
    async addPlayerToken(code, token, playerId){ check(await db.rpc('add_player_token', { p_code: code, p_token: token, p_player_id: playerId })); },
  };
}

let store = null;
export function getStore(){
  if (store) return store;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) store = supabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  else {
    console.warn('[generala] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: using the in-memory room store (local development only).');
    store = memoryStore();
  }
  return store;
}
export function setStore(s){ store = s; }
