# chromacast v2 — Diseño

**Fecha:** 2026-07-05
**Estado:** Aprobado por el usuario (secciones 1–4)
**Proyecto:** `chromacast/` (frontend Vite+React+TS, backend Express+TS)

## Contexto y objetivo

chromacast sincroniza luces de Home Assistant con la música de Spotify. La v1 ya
implementa: layout en dos mitades (cover art a la izquierda; reproductor, panel de
luces, cola e historial a la derecha), extracción de paleta con node-vibrant, y color
base al pausar con timeout fijo de 5s.

La v2 cubre los faltantes detectados, un rediseño del lado derecho, cuatro features
nuevas elegidas por el usuario, y la preparación del proyecto para publicarse como
open source self-hosteable (Docker).

**Fuera de alcance (roadmap futuro):** versión hostada multi-usuario (cuentas, DB,
multi-tenancy, HA expuesto a internet). Se documenta en el README como roadmap,
no se diseña ahora.

## Bug conocido que esta versión arregla

La detección de pausa vive en el handler de `GET /api/now-playing`
(`backend/src/routes/spotify.ts:90-107`) y solo corre cuando el frontend hace polling;
el frontend deja de consultar cuando la pestaña está oculta (`App.tsx` usa
`document.hidden`). Resultado: con la pestaña cerrada u oculta, las luces nunca
vuelven al color base tras pausar. La v2 mueve toda la automatización al backend.

## 1. Layout y UI

### Fondo
- La cover del track actual a pantalla completa, blureada (~60px) y oscurecida con
  un degradado negro (scrim) para legibilidad. Crossfade suave al cambiar de canción.
- Fallback cuando no hay cover: el gradiente de paleta actual de `AmbientBackground`.
- `AmbientBackground` pasa a renderizar la imagen (dos capas para el crossfade).

### Mitad izquierda (sin cambios estructurales)
- Cover cuadrada, bordes redondeados (16px), padding, glow con color de paleta,
  sticky. Como en v1.

### Mitad derecha (de arriba a abajo)
1. **Barra superior:** botón ⛶ (modo kiosk) y botón ⚙️ (configuración).
2. **Reproductor:** track/artista/álbum, barra de progreso, controles
   play/pausa/next/prev, volumen (componentes existentes).
3. **Tarjeta Luces:** toggle on/off, presets (relax/party/cinema/focus), sliders de
   brillo y transición, selección de color primario/secundario. `ColorPalette` y
   `MockLight` se integran dentro de esta tarjeta (dejan de flotar sueltos;
   `MockLight` visible solo con HA desactivado). Se agregan: toggle **Modo fiesta**
   con slider de velocidad, e indicador 🌙 cuando el modo nocturno está activo.
4. **Sección segmentada Cola | Letra | Historial:** un solo área que cambia de
   contenido según el segmento activo. Reemplaza a `QueuePanel` y `TrackHistory`
   como paneles independientes.

### Modal de configuración (⚙️)
Overlay centrado que reutiliza el formulario del primer arranque (`ConfigForm`) y
agrega los campos nuevos. Contenido:
- Credenciales Spotify (client id/secret/redirect) y HA (URL, token, entidades
  primarias/secundarias) — editables después del primer arranque.
- Color base al pausar (color picker + presets; se muda acá desde `LightPanel`).
- **Acción al pausar:** `volver al color base` | `apagar luces`.
- **Segundos de pausa** antes de ejecutar la acción (número, default 5).
- **Modo nocturno:** activado (bool), hora inicio, hora fin, brillo máximo.

La velocidad del modo fiesta NO va en el modal: se ajusta con el slider de la
tarjeta Luces (junto al toggle) y se persiste en `partySpeedSec`.

### Modo kiosk (⛶)
Pantalla completa (Fullscreen API): solo fondo blureado + cover centrada + nombre
de track y artista. Cursor auto-oculto tras inactividad. Clic/toque sale del modo.

## 2. Arquitectura del backend

### Poller (`backend/src/services/poller.ts`)
- `setInterval` de 4s mientras haya sesión de Spotify válida.
- Por iteración: obtiene now-playing; si cambió el track extrae paleta y guarda
  historial; detecta transiciones play↔pausa y notifica al motor de automatización;
  actualiza un cache en memoria.
- `GET /api/now-playing` sirve el cache (respuesta instantánea, menos requests a
  Spotify que el polling por pestaña de v1).
- Cada iteración aislada con try/catch: un fallo de Spotify/HA se loguea y expone
  como estado, nunca tumba el poller.

### Motor de automatización (`backend/src/services/automation.ts`)
Concentra todas las reglas; corre 100% en el servidor:
- **Pausa:** al detectar pausa arranca timer con los segundos configurados; al
  disparar ejecuta la acción configurada (color base con brillo atenuado, o apagar
  luces vía HA). Al reanudar, cancela el timer y restaura los colores del track.
- **Modo fiesta:** interval que rota los colores de la paleta del track actual entre
  entidades primarias/secundarias cada N segundos (config). Se detiene con la
  música en pausa y al desactivar el toggle; se retoma al reanudar.
- **Tope nocturno:** si la hora actual está en el rango configurado, todo update de
  luces clampa el brillo a `maxBrightness`. Aplica en un único punto (wrapper de
  `updateLights`).

### Persistencia (`backend/data/config.json`, gitignoreado)
- Contenido: credenciales Spotify/HA, entidades, color base, `pauseTimeoutSec`,
  `pauseAction`, `nightMode {enabled, start, end, maxBrightness}`,
  `partySpeedSec`, `lightsEnabled`, refresh token de Spotify.
- Carga al boot, escritura en cada cambio (write atómico: tmp + rename).
- **Las variables de entorno tienen prioridad** sobre lo guardado (12-factor):
  ideal para Docker y para no persistir credenciales si el usuario prefiere .env.

### API (cambios)
- `GET/PUT /api/settings` — toda la configuración editable en un solo recurso.
- `POST /api/lights/party` — on/off del modo fiesta.
- `GET /api/lyrics` — letra del track actual (proxy a lrclib con cache).
- Se mantienen los endpoints de player/luces existentes; los de
  `default-color` se absorben en `/api/settings`.

### Empaquetado open source
- `Dockerfile` multi-stage: compila el frontend, Express sirve estáticos + API en
  un solo contenedor.
- `docker-compose.yml` con volumen para `/data`.
- `.env.example`, `LICENSE` (MIT), `README.md` con instrucciones de self-hosting
  (Docker y modo dev), sección de roadmap (versión hostada).
- Sin secretos en el repo: `data/` gitignoreado.

## 3. Comportamiento de las features

### Letras (lrclib.net)
- Backend: `GET https://lrclib.net/api/get?artist_name=&track_name=&duration=`
  (gratuita, sin API key). Cache en memoria por track id.
- Frontend (segmento "Letra"): líneas sincronizadas (formato LRC) resaltando la
  actual según `progressMs`; auto-scroll. Si solo hay letra plana, se muestra
  estática. Si no hay resultado o lrclib falla: "Letra no disponible".

### Modo fiesta
- Toggle y slider de velocidad en la tarjeta Luces (default 8s por color,
  persistido en `partySpeedSec`).
- Rotación server-side de colores de paleta entre entidades. Pausa/reanuda con
  la música; interactúa con la regla de pausa (la pausa gana).

### Modo nocturno
- Config: enabled, start (HH:mm), end (HH:mm), maxBrightness. Soporta rangos que
  cruzan medianoche (ej. 23:00–07:00).
- Indicador 🌙 en la tarjeta Luces cuando está activo.

### Acción al pausar
- A los N segundos configurados: `color base` (brillo atenuado con tope 120/255
  como en v1, transición suave) o `apagar`. Al reanudar, restaura colores del
  track actual.

## 4. Errores y verificación

- Poller: try/catch por iteración; errores de HA/Spotify se loguean y se exponen
  en `GET /api/now-playing` / estado de luces; la tarjeta Luces muestra
  "HA no responde" sin romper el resto.
- Rate limits de Spotify: un solo poller de 4s reemplaza el polling por pestaña.
- lrclib caído: degrada al mensaje de no disponible, nunca bloquea el reproductor.
- **Tests (vitest, backend):** motor de automatización con timers falsos —
  pausa→acción→reanudar, clamp nocturno (incluyendo rango que cruza medianoche),
  ciclo de modo fiesta, precedencia env vars > config.json.
- Verificación manual del UI: flujo completo con Spotify real y MockLight.

## Decisiones registradas

| Decisión | Elección |
|---|---|
| Alcance | Faltantes + rediseño del layout completo |
| Organización lado derecho | Config en modal (⚙️); player + luces + cola visibles |
| Features player | Letras sincronizadas |
| Features luces | Modo fiesta, nocturno, apagar al pausar, kiosk |
| Arquitectura | A: backend como cerebro (poller + automatización server-side) |
| Open source | Self-hosted ahora (Docker); versión hostada como roadmap futuro |
| Companion visual | Declinado; diseño en texto |
