// Persistence on Vega: @amazon-devices/react-native-async-storage__async-storage (Vega port of
// @react-native-async-storage/async-storage). The legacy AsyncStorage bundled in react-native-kepler is
// deprecated and, on the VVD, lost writes when the app process was killed.
import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';

const SESSION_KEY = 'generala.tv.session'; // { code, hostToken }
const PREFS_KEY = 'generala.tv.prefs';     // { lang, muted }

const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + what)), ms))]);

async function read(key){
  try { const raw = await withTimeout(AsyncStorage.getItem(key), 3000, 'read ' + key); return raw ? JSON.parse(raw) : null; } catch (e) { console.warn('[generala] storage read failed', key, String(e)); return null; }
}
async function write(key, value){
  try { if (value == null) await AsyncStorage.removeItem(key); else await AsyncStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('[generala] storage write failed', key, String(e)); /* run without persistence */ }
}

export const loadSession = () => read(SESSION_KEY);
export const saveSession = (s) => write(SESSION_KEY, s);
export const clearSession = () => write(SESSION_KEY, null);
export const loadPrefs = async () => (await read(PREFS_KEY)) || {};
export const savePrefs = (p) => write(PREFS_KEY, p);
