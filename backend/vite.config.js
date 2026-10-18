import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { networkInterfaces } from 'node:os';

const lanAddress = () => Object.values(networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;

// Serves /api/* from the same handler modules Vercel deploys (api/), so `npm run dev` is the whole stack.
function api(){
  return {
    name: 'generala-api',
    configureServer(server){
      const lan = lanAddress();
      if (lan && !process.env.GENERALA_LAN_HOST) process.env.GENERALA_LAN_HOST = lan;
      let router;
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        try {
          router = router || await import('./lib/router.js');
          if (!(await router.handleApi(req, res))) next();
        } catch (e) { next(e); }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // expose SUPABASE_* / PUBLIC_URL from .env files to the API handlers (process.env), like Vercel does
  const env = loadEnv(mode, process.cwd(), '');
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'PUBLIC_URL']) if (env[k] && !process.env[k]) process.env[k] = env[k];
  return {
    plugins: [react(), api()],
    server: { host: '0.0.0.0', port: 5173, strictPort: true },
    preview: { host: '0.0.0.0' },
  };
});
