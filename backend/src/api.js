// Browser client for the Generala API + live room updates (Supabase Realtime when available, plus polling).

export class ApiError extends Error { constructor(code, status){ super(code); this.code = code; this.status = status; } }
export const isOffline = e => !(e instanceof ApiError) || e.status >= 500;

export async function api(method, path, body){
  let r;
  try { r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
  catch (e) { throw new ApiError('offline', 0); }
  let data = null; try { data = await r.json(); } catch (e) {}
  if (!r.ok) throw new ApiError((data && data.error) || 'server', r.status);
  return data;
}

let cfgPromise = null;
export function getConfig(){
  if (!cfgPromise) cfgPromise = api('GET', '/api/config').catch(e => { cfgPromise = null; throw e; });
  return cfgPromise;
}

export const rooms = {
  create: opts => api('POST', '/api/rooms', opts),
  get: code => api('GET', `/api/rooms/${code}`),
  join: (code, body) => api('POST', `/api/rooms/${code}/join`, body),
  host: (code, hostToken, action, extra) => api('POST', `/api/rooms/${code}/host`, { hostToken, action, ...extra }),
  play: (code, playerToken, action, extra) => api('POST', `/api/rooms/${code}/play`, { playerToken, action, ...extra }),
};

// Calls onState(state) for every newer room state; onError(code | 'offline') when polling fails; onOk() when it works again.
// Returns stop().
export function watchRoom(code, { onState, onError, onOk }){
  let stopped = false, live = false, inflight = false, timer = null, channel = null, client = null;
  const poll = async () => {
    if (stopped || inflight) return;
    inflight = true; clearTimeout(timer);
    try { const r = await rooms.get(code); if (!stopped) { onOk && onOk(); onState(r.state); } }
    catch (e) { if (!stopped) onError && onError(isOffline(e) ? 'offline' : e.code); }
    inflight = false;
    if (!stopped) timer = setTimeout(poll, live ? 5000 : 1000);
  };
  poll();
  getConfig().then(async cfg => {
    if (stopped || !cfg.realtime) return;
    const { createClient } = await import('@supabase/supabase-js');
    if (stopped) return;
    client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false } });
    channel = client.channel('room-' + code)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: 'code=eq.' + code }, payload => { if (!stopped && payload.new && payload.new.state) onState(payload.new.state); })
      .subscribe(status => { live = status === 'SUBSCRIBED'; });
  }).catch(() => {});
  const wake = () => { if (document.visibilityState === 'visible') poll(); };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  return () => {
    stopped = true; clearTimeout(timer);
    document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake);
    if (channel && client) client.removeChannel(channel);
  };
}

export const store = {
  get(key){ try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; } },
  set(key, v){ try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} },
};
