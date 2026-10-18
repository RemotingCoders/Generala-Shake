import { route } from '../lib/http.js';
import { clientConfig } from '../lib/config.js';
import { getStore } from '../lib/store.js';

// GET /api/config
export default route('GET', ({ req }) => ({ body: clientConfig(req, getStore().kind) }));
