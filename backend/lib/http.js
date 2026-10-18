// HTTP helpers shared by every /api handler (Vercel Node runtime and the local dev/test router).

export class ApiError extends Error {
  constructor(status, code){ super(code); this.status = status; this.code = code; }
}
export const fail = (status, code) => { throw new ApiError(status, code); };

const STATUS = { badRequest: 400, unauthorized: 401, notfound: 404, expired: 410 }; // everything else: 409
export const statusOf = code => STATUS[code] || 409;

export function cors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function send(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Vercel pre-parses JSON bodies into req.body (object, or string for other content types); the dev router doesn't.
export async function readBody(req){
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
    return req.body || {};
  }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 64 * 1024) fail(400, 'badRequest'); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

// route('POST', async ({ body, query, req }) => ({ status, body })) → Vercel handler
export function route(method, fn){
  return async function handler(req, res){
    cors(res);
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    try {
      if (req.method !== method) fail(405, 'badRequest');
      let body = {};
      if (method === 'POST') { try { body = await readBody(req); } catch (e) { if (e instanceof ApiError) throw e; fail(400, 'badRequest'); } }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'badRequest');
      const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      const out = await fn({ body, query, req });
      send(res, out.status || 200, out.body);
    } catch (e) {
      if (e instanceof ApiError) return send(res, e.status, { error: e.code });
      console.error('[api]', req.method, req.url, e);
      send(res, 500, { error: 'server' });
    }
  };
}
