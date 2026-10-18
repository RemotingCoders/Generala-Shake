// Maps /api/* URLs to the same handler modules Vercel deploys from api/ (used by the Vite dev server and the tests).
import config from '../api/config.js';
import rooms from '../api/rooms/index.js';
import room from '../api/rooms/[code]/index.js';
import join from '../api/rooms/[code]/join.js';
import host from '../api/rooms/[code]/host.js';
import play from '../api/rooms/[code]/play.js';
import { cors, send } from './http.js';

const ROUTES = [
  [/^\/api\/config\/?$/, config],
  [/^\/api\/rooms\/?$/, rooms],
  [/^\/api\/rooms\/([^/]+)\/?$/, room],
  [/^\/api\/rooms\/([^/]+)\/join\/?$/, join],
  [/^\/api\/rooms\/([^/]+)\/host\/?$/, host],
  [/^\/api\/rooms\/([^/]+)\/play\/?$/, play],
];

// Returns false when the URL isn't an API route.
export async function handleApi(req, res){
  const url = new URL(req.url, 'http://local');
  if (!url.pathname.startsWith('/api/')) return false;
  for (const [re, handler] of ROUTES) {
    const m = url.pathname.match(re);
    if (!m) continue;
    req.query = { ...Object.fromEntries(url.searchParams), ...(m[1] ? { code: decodeURIComponent(m[1]) } : {}) };
    await handler(req, res);
    return true;
  }
  cors(res); send(res, 404, { error: 'notfound' });
  return true;
}
