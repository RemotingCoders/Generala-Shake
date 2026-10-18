import { cors, send, ApiError } from '../lib/http.js';
import { narratorText, speak } from '../lib/tts.js';

// GET /api/tts?lang=es&k=full&name=Ana&score=30[&cat=…&n=…] → audio/mpeg of that narrator line.
// Same URL = same audio, so the CDN keeps it for a year and each distinct line is generated (and paid) once.
export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'badRequest' });
    const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const lang = query.lang === 'en' ? 'en' : 'es';
    const audio = await speak(narratorText(query), lang);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    res.end(audio);
  } catch (e) {
    if (e instanceof ApiError) return send(res, e.status, { error: e.code });
    console.error('[api] tts', e);
    send(res, 500, { error: 'server' });
  }
}
