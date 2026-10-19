import { cors, send, ApiError } from '../lib/http.js';
import { narratorAudio } from '../lib/tts.js';

// GET /api/tts?lang=es&k=full&v=3&name=Ana&score=30[&cat=…&n=…] → audio/mpeg of that narrator line.
// Usually already generated in the background when the event happened (lib/tts.js prewarm); the CDN also
// keeps each URL for a year.
export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'badRequest' });
    const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const audio = await narratorAudio(query);
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
