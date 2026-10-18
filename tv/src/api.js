// Thin client for the Generala HTTP API (see docs/ARCHITECTURE.md). The TV is the host.
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';

export class ApiError extends Error {
  constructor(code, status){ super(code); this.code = code; this.status = status; }
}

async function request(method, path, body){
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(API_BASE_URL + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    });
  } catch (e) {
    throw new ApiError('network', 0);
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) throw new ApiError((data && data.error) || 'http' + res.status, res.status);
  return data;
}

export const api = {
  config: () => request('GET', '/api/config'),
  createRoom: (opts) => request('POST', '/api/rooms', opts),
  getRoom: (code) => request('GET', '/api/rooms/' + encodeURIComponent(code)),
  host: (code, hostToken, action, extra) => request('POST', '/api/rooms/' + encodeURIComponent(code) + '/host', { hostToken, action, ...(extra || {}) }),
};

// A room that no longer exists for the host: go home.
export const isGone = (e) => e && (e.status === 404 || e.status === 410 || e.status === 401 || e.code === 'notfound' || e.code === 'expired' || e.code === 'unauthorized' || e.code === 'closed');
