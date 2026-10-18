// Environment + public URL helpers.

export function publicUrl(req){
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const h = req.headers || {};
  const proto = String(h['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim();
  let host = String(h['x-forwarded-host'] || h.host || 'localhost').split(',')[0].trim();
  // local dev: a QR pointing at localhost is useless for a phone, so the dev server swaps in the LAN address
  const lan = process.env.GENERALA_LAN_HOST;
  if (lan && /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host)) host = host.replace(/^(localhost|127\.0\.0\.1|\[::1\])/, lan);
  return `${proto}://${host}`;
}

export function clientConfig(req, storeKind){
  const { SUPABASE_URL = '', SUPABASE_ANON_KEY = '' } = process.env;
  return { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY, publicUrl: publicUrl(req), realtime: storeKind === 'supabase' && !!SUPABASE_URL && !!SUPABASE_ANON_KEY };
}
