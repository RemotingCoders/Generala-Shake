# Generala — app de TV (Vega OS / Fire TV)

App anfitriona para Fire TV hecha con **React Native para Vega** (RN 0.83, `@amazon-devices/react-native-kepler` 4.x).
La tele crea la sala, muestra el QR y el código, los dados, la planilla, el relator y los resultados; los
jugadores se unen y juegan desde el navegador del celular. El servidor (`backend/`) es la única fuente de verdad.

## Requisitos

- macOS con Vega SDK 0.24 y Vega CLI (`~/vega/bin/vega`, probado con 1.4.4).
- Node 20+ (probado con 24) y npm.
- Vega Virtual Device (VVD) instalado con el SDK.
- El backend corriendo (local o en Vercel), ver `backend/` y `docs/ARCHITECTURE.md`.

## Instalar dependencias

```bash
cd tv
npm install
```

Los archivos `src/shared/engine.js` e `i18n.js` se generan desde `shared/`: `node scripts/sync-shared.mjs` (desde la raíz).

## Compilar

```bash
cd tv
scripts/build.sh Debug      # o Release
```

El paquete queda en `build/aarch64-debug/generala_aarch64.vpkg` (VVD en Mac Apple Silicon) y también se generan
`armv7` (Fire TV reales) y `x86_64`.

> La toolchain de Vega falla si la ruta del proyecto tiene espacios (`kepler-module-manifest-builder` ejecuta un
> comando sin comillas). `scripts/build.sh` lo detecta, copia `tv/` a `/tmp/generala-tv-build` (cambiable con
> `VEGA_BUILD_DIR`), compila ahí y trae `build/` de vuelta. Sin espacios en la ruta, equivale a
> `npx react-native build-vega --build-type Debug`.

## Virtual device

```bash
vega virtual-device start      # abre el emulador (tarda ~1 min la primera vez)
vega virtual-device status
vega device list               # debería listar "VirtualDevice : tv - aarch64"
```

## Instalar y abrir

```bash
vega run-app build/aarch64-debug/generala_aarch64.vpkg com.generalashake.tv.main
# o por partes:
vega device install-app ... / vega device launch-app --appName com.generalashake.tv.main
vega device terminate-app --appName com.generalashake.tv.main
```

Reinstalar borra los datos de la app (la sala guardada); cerrar y volver a abrir la app la conserva.

## Servidor (API_BASE_URL)

Se configura en `src/config.ts`:

```ts
export const API_BASE_URL: string = LOCAL_API_BASE_URL;   // 'http://10.0.2.2:5180'
// export const API_BASE_URL: string = VERCEL_API_BASE_URL; // 'https://<tu-proyecto>.vercel.app'
```

- **Local**: el VVD es una VM QEMU con red de usuario; desde adentro, la Mac es **`10.0.2.2`** (también funciona la IP
  de la Mac en la LAN). Levantá el backend con
  `cd backend && npm run dev -- --port 5180`.
  El `joinUrl` del QR lo arma el servidor según el host del pedido; como la tele llama a `10.0.2.2`, conviene
  arrancar el backend con `PUBLIC_URL=http://<IP-LAN-de-la-Mac>:5180` para que el QR funcione desde un celular.
- **Vercel**: cambiá `API_BASE_URL` a la URL desplegada (sin `/` final) y recompilá.

Actualizaciones en vivo: polling de `GET /api/rooms/:code` cada 1000 ms (se ignoran estados con `seq` menor).
No se usa Supabase Realtime en la tele.

## Dados 3D

En la partida por turnos, la bandeja muestra dados 3D (Three.js r170) dentro de un WebView
(`@amazon-devices/webview` 4.0.2; el `manifest.toml` declara el módulo webview y el servicio
`com.amazon.webview.renderer_service`).

- La página es `assets/dice3d/` (`index.html`, `motion-engine.js`, `three.classic.js`): son **copias generadas** de
  `shared/dice3d/` con `node scripts/sync-shared.mjs` (desde la raíz). No editarlas acá.
- `src/ui/Dice3D.js` la alimenta con `window.diceUpdate({dice, held, rolled, rollId, shaking, color, reduced})`
  (protocolo en `docs/ARCHITECTURE.md`, "3D dice view"). Mientras el jugador agita el celular los dados giran y el
  estado dice "Agitando…"; con una tirada nueva frenan en 5 s sobre los valores del servidor. Los dados guardados
  no giran: quedan levantados y con un marco del color del jugador. La planilla muestra los puntajes posibles recién
  cuando los dados caen.
- Si el WebView no carga (o no responde en 12 s) se usan los dados 2D de siempre. El modo simultáneo usa siempre 2D.
- El WebView no toma el foco del control remoto (los botones de arriba tienen `nextFocusDown` hacia sí mismos).
- Depuración: en `src/config.ts`, `DICE3D_DEBUG_URL = 'http://10.0.2.2:8766'` manda cada mensaje del WebView
  (`ready`, `settled` con las caras leídas de la escena, `stats` con fps) a un receptor HTTP en la Mac.
  `DICE3D_ENABLED = false` vuelve a los dados 2D.

## Control remoto (D-pad)

| Tecla | Acción |
|---|---|
| Flechas | Mover el foco (navegación espacial nativa de Vega; el foco se marca con un aro amarillo) |
| OK / Select | Elegir |
| Atrás | Ayuda → cerrar · Configuración → inicio · Sala de espera → cerrar sala · Partida → pausar/reanudar · Resultados / sala cerrada → inicio · Inicio → salir de la app |

En el emulador: flechas y Enter del teclado; Esc = Atrás. Para automatizar:
`vda shell 'inputd-cli button_press KEY_RIGHT'` (`KEY_ENTER`, `KEY_BACK`, ...).

## Estructura

- `src/App.js` — estado, flujo del anfitrión, polling, tecla Atrás, persistencia de `{code, hostToken, joinUrl}`.
- `src/screens.js` — pantallas (inicio, configuración, sala, partida por turnos / simultánea, pausa, resultados, sala cerrada, ayuda).
- `src/viewModel.js` — datos de pantalla derivados del estado del servidor (no calcula resultados).
- `src/ui/` — escalado 1280×720 → pantalla real, botones enfocables, dados, QR (`qrcode-generator`), relator.
- `src/api.js`, `src/storage.js`, `src/config.ts`.
- `assets/fonts/` — Fredoka y Nunito (OFL). Vega registra cada fuente por nombre de archivo (`Nunito-Bold`, ...).
- `test/` — `npm test` (Jest).

## Voz del relator

Las frases del relator se escuchan por el parlante de la tele: `src/ui/Voice.js` reproduce el audio de `GET <API>/api/tts` (OpenAI, ver `backend/README.md`) en un WebView oculto. Respeta "Silenciar" y el relator apagado. Requiere `OPENAI_API_KEY` en Vercel; sin ella la tele queda en silencio sin errores visibles. En Vega el audio solo suena si la app pide el foco de audio (`@amazon-devices/keplerscript-audio-lib`, servicio `com.amazon.audio.control` en `manifest.toml`): `Voice.js` lo pide antes de cada frase y lo libera al terminar.
