// Narrator text-to-speech with OpenAI (gpt-4o-mini-tts). The client never sends free text: it sends a narrator
// template key + its variables, and the line is rendered here from shared/i18n.js NARRATOR, so the endpoint
// can only ever speak narrator lines (no open TTS proxy billed to our key).
import { NARRATOR, CATS, fmt } from '../shared/i18n.js';
import { fail } from './http.js';

const MODEL = () => process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const VOICE = () => process.env.OPENAI_TTS_VOICE || 'ash';
const INSTRUCTIONS = {
  es: 'Sos el relator de una partida de dados en una reunión familiar en Argentina. Hablá en español rioplatense, con acento de Buenos Aires y voseo. Tono entusiasta, cálido y con humor, ritmo ágil, como un relator de fútbol pero en el living de casa.',
  en: 'You are the commentator of a dice game at a family game night. American English. Upbeat, warm and playful, with lively pacing, like a sports announcer in a living room.',
};

const CAT_NAMES = lang => new Set(Object.values(CATS).flatMap(v => Object.values(v[lang] || {})));
const int = (v, min, max) => { if (v === undefined || v === '') return undefined; const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) fail(400, 'badRequest'); return n; };

// query: { lang, k, name?, score?, cat?, n? } → the narrator line
export function narratorText(query){
  const lang = query.lang === 'en' ? 'en' : query.lang === 'es' ? 'es' : fail(400, 'badRequest');
  const tpl = NARRATOR[lang][query.k];
  if (!tpl) fail(400, 'badRequest');
  const name = String(query.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (name.length > 14) fail(400, 'badRequest');
  const cat = query.cat ? String(query.cat) : '';
  if (cat && !CAT_NAMES(lang).has(cat)) fail(400, 'badRequest');
  return fmt(tpl[0], { name, score: int(query.score, 0, 200), cat, n: int(query.n, 1, 13) });
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
