// Narrator text-to-speech with OpenAI (gpt-4o-mini-tts). The client never sends free text: it sends a narrator
// template key + its variables, and the line is rendered here from shared/i18n.js NARRATOR, so the endpoint
// can only ever speak narrator lines (no open TTS proxy billed to our key).
//
// Generating a line takes ~1.5–2.5 s, so the audio is made in the background as soon as the event happens
// (prewarm, called from rooms.js) and kept in Supabase Storage (bucket `tts`, private), shared by every region
// and deploy. By the time the TV asks for it, GET /api/tts only has to read it back.
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NARRATOR, CATS, fmt, narratorLine } from '../shared/i18n.js';
import { fail } from './http.js';

const MODEL = () => process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const VOICE = () => process.env.OPENAI_TTS_VOICE || 'ash';
const BUCKET = 'tts';
const INSTRUCTIONS = {
  es: 'Sos el relator de una partida de dados en una reunión familiar en Argentina. Hablá en español rioplatense, con acento de Buenos Aires y voseo. Tono entusiasta, cálido y con humor, ritmo ágil, como un relator de fútbol pero en el living de casa.',
  en: 'You are the commentator of a dice game at a family game night. American English. Upbeat, warm and playful, with lively pacing, like a sports announcer in a living room.',
};

const CAT_NAMES = lang => new Set(Object.values(CATS).flatMap(v => Object.values(v[lang] || {})));
const int = (v, min, max) => { if (v === undefined || v === null || v === '') return undefined; const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) fail(400, 'badRequest'); return n; };

// query: { lang, k, v? (variant index), name?, score?, cat?, n? } → the narrator line
export function narratorText(query){
  const lang = query.lang === 'en' ? 'en' : query.lang === 'es' ? 'es' : fail(400, 'badRequest');
  const tpl = NARRATOR[lang][query.k];
  if (!tpl) fail(400, 'badRequest');
  const name = String(query.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (name.length > 14) fail(400, 'badRequest');
  const cat = query.cat ? String(query.cat) : '';
  if (cat && !CAT_NAMES(lang).has(cat)) fail(400, 'badRequest');
  return fmt(tpl[int(query.v, 0, tpl.length - 1) || 0], { name, score: int(query.score, 0, 200), cat, n: int(query.n, 1, 13) });
}

export async function speak(text, lang){
  const key = process.env.OPENAI_API_KEY;
  if (!key) fail(503, 'ttsUnavailable');
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL(), voice: VOICE(), input: text, instructions: INSTRUCTIONS[lang], response_format: 'mp3' }),
  });
  if (!r.ok) { console.error('[tts] openai', r.status, (await r.text()).slice(0, 300)); fail(502, 'ttsFailed'); }
  return Buffer.from(await r.arrayBuffer());
}

// ---- audio cache: Supabase Storage when configured, else an in-memory map (local dev) ----
let cache;
function getCache(){
  if (cache) return cache;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const mem = new Map();
    return (cache = { get: async k => mem.get(k) || null, put: async (k, b) => { mem.set(k, b); } });
  }
  const bucket = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  let ready = null;
  const ensure = () => (ready = ready || bucket.createBucket(BUCKET, { public: false }).then(() => {}, () => {})); // exists → error, fine
  return (cache = {
    async get(k){ const { data, error } = await bucket.from(BUCKET).download(k); return error || !data ? null : Buffer.from(await data.arrayBuffer()); },
    async put(k, b){
      await ensure();
      const { error } = await bucket.from(BUCKET).upload(k, b, { contentType: 'audio/mpeg', upsert: true });
      if (error) console.error('[tts] storage upload', error.message);
    },
  });
}
const cacheKey = (text, lang) => `${MODEL()}/${VOICE()}/${lang}/${createHash('sha1').update(text).digest('hex')}.mp3`;

// Same instance, same line already being generated → share the promise instead of paying twice.
const inflight = new Map();

// query → MP3 bytes (cache first, else generate + store)
export async function narratorAudio(query){
  const text = narratorText(query), lang = query.lang === 'en' ? 'en' : 'es', key = cacheKey(text, lang);
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const hit = await getCache().get(key).catch(() => null);
    if (hit) return hit;
    const audio = await speak(text, lang);
    await getCache().put(key, audio).catch(e => console.error('[tts] cache put', e && e.message));
    return audio;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

// Background pre-generation for the narrator lines of new events, in both TV languages (the TV language is a
// per-device setting the server doesn't know). Never throws; returns a promise for waitUntil.
export function prewarm(state, events){
  if (!process.env.OPENAI_API_KEY || !state || state.narrator === false || !events || !events.length) return null;
  const jobs = [];
  for (const ev of events) for (const lang of ['es', 'en']) {
    const line = narratorLine(lang, state, ev);
    if (line) jobs.push(narratorAudio({ lang, k: line.k, v: line.v, ...line.vars }).catch(e => console.error('[tts] prewarm', e && (e.code || e.message))));
  }
  return jobs.length ? Promise.all(jobs) : null;
}
