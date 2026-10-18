# Generala · backend + control web

Proyecto de Vercel: API serverless (`api/`), control del celular (Vite + React) y web de TV para depurar. Contrato completo en `../docs/ARCHITECTURE.md`.

- `/` — control del celular (lo que abre el QR: `/?room=CODE`).
- `/?surface=tv` (o `/tv`) — anfitrión web: crear sala, QR, iniciar, pausar, resultados. Se maneja con flechas, Enter y Retroceso. Es un respaldo para depurar; el anfitrión real es la app de Fire TV.
- `/api/*` — API (ver contrato).

## Desarrollo local

```bash
cd backend
npm install
npm run dev                  # http://0.0.0.0:5173 (web + /api juntos)
npm run dev -- --port 5180   # otro puerto
npm test                     # partidas completas contra la API (store en memoria)
npm run build
```

Sin variables de Supabase la API usa un store en memoria (se pierde al reiniciar, sin Realtime; los clientes hacen polling cada 1 s). En dev, el QR usa la IP de la red local en lugar de `localhost` para que el celular pueda abrirlo (misma Wi-Fi).

Las reglas (`shared/engine.js`, `shared/i18n.js`) y los dados 3D (`shared/dice3d/`) se editan en la carpeta `shared/` de la raíz y se copian con `node scripts/sync-shared.mjs` (o `npm run sync` desde `backend/`). No editar `backend/shared/` ni `backend/public/dice3d/` a mano.

## Agitar y dados 3D

- Celular: mantener apretado **Tirar** (o sacudir el celular, con el permiso de movimiento) manda `play {action:'shake', active:true}`; al soltar (o cuando el celular se queda quieto) manda `roll`. Un toque corto tira directo. La detección usa `ShakeDetector` de `shared/dice3d/motion-engine.js`.
- Después de cada tirada el celular esconde los dados nuevos durante `DICE_SETTLE_MS` (5 s, el tiempo que tardan en caer en la TV); los dados guardados siguen a la vista. Recién ahí se puede guardar dados o anotar.
- TV web (`/?surface=tv`): en modo por turnos los dados son la vista 3D `/dice3d/index.html` en un iframe; si no carga en 4 s o reporta error, vuelve a los dados 2D. El cartel del turno muestra "Agitando…".

## Variables de entorno

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | clave `service_role` (solo servidor; nunca en el cliente) |
| `SUPABASE_ANON_KEY` | clave `anon` (la reciben los clientes por `/api/config` para Realtime) |
| `PUBLIC_URL` | opcional: URL pública para el QR (si no, se deriva del host del pedido) |

Para dev con Supabase: copiar `.env.example` a `.env.local` y completar.

## Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com) (región cercana a los jugadores).
2. SQL Editor → pegar y ejecutar `supabase/schema.sql` (crea `rooms`, `room_secrets`, RLS, la función `add_player_token` y agrega `rooms` a la publicación de Realtime).
3. Project Settings → API: copiar la URL, la `anon` key y la `service_role` key.
4. Opcional, limpieza de salas vencidas: Database → Extensions → habilitar `pg_cron` y ejecutar
   `select cron.schedule('generala-cleanup', '0 * * * *', $$select public.cleanup_expired_rooms()$$);`

## Deploy en Vercel

1. Importar el repo en Vercel.
2. **Root Directory: `backend`**. Framework Preset: **Vite** (build `npm run build`, output `dist`). Las funciones de `api/` se detectan solas (runtime Node).
3. Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (y `PUBLIC_URL` si se usa un dominio propio).
4. Deploy. Probar `https://TU-APP.vercel.app/api/config` → debe devolver `"realtime": true`.

`vercel.json` solo agrega la reescritura de rutas del SPA (`/tv`) sin tocar `/api`.

## Apuntar la app de TV

En `tv/src/config.ts` poner la URL base de la API: `https://TU-APP.vercel.app` (producción) o `http://IP-DE-TU-MAC:5173` (dev local en la misma red). La TV crea la sala con `POST /api/rooms` y muestra el `joinUrl` que devuelve el servidor en el QR.

## Voz del relator (OpenAI)

`GET /api/tts` genera el audio de cada frase del relator con OpenAI (`gpt-4o-mini-tts`). Cargá en Vercel → Settings → Environment Variables:

- `OPENAI_API_KEY` (obligatoria para que la tele hable; sin ella `/api/tts` responde 503 y la tele queda en silencio)
- Opcionales: `OPENAI_TTS_VOICE` (por defecto `ash`), `OPENAI_TTS_MODEL` (por defecto `gpt-4o-mini-tts`)

Solo acepta frases del relator (tipo de frase + nombre/puntaje/categoría/ronda), no texto libre. Cada frase distinta se genera una sola vez y después la sirve la CDN de Vercel.
