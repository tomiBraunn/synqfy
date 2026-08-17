# synqfy

Sincroniza tus luces de Home Assistant con lo que suena en Spotify. El backend
extrae la paleta de colores de la portada del álbum y la proyecta en tus luces;
la UI muestra la portada sobre un fondo blureado, con reproductor, letras
sincronizadas, cola e historial.

## Features

- 🎨 Colores de las luces extraídos de la portada del álbum (node-vibrant)
- 💡 Automatización server-side: funciona aunque cierres el navegador
- ⏸️ Al pausar: vuelve a un color base o apaga las luces (tiempo configurable)
- 💡 Elegís desde la página qué lámpara toma el color principal y cuál el acento
- 🌙 Modo nocturno: tope de brillo por horario
- 🎤 Letras sincronizadas vía [lrclib.net](https://lrclib.net)
- 🖥️ Modo kiosk para tablets y pantallas de adorno
- ⚙️ Todo configurable desde la UI, persistido en disco

## Requisitos

- Una app en el [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
  (Client ID + Secret, y registrar el Redirect URI)
- Home Assistant accesible en tu red con un token de acceso de larga duración
  (opcional: sin HA la app funciona como reproductor)

## Quick start con Docker

```bash
cd synqfy
cp .env.example .env   # opcional: completar credenciales
docker compose up -d
```

Abrí http://localhost:3001, completá la configuración inicial (si no usaste
`.env`) y conectá tu cuenta de Spotify.

## En una Raspberry Pi

Cada push a `main` compila la imagen para `arm64` y la publica en
`ghcr.io/tomibraunn/synqfy`. La Pi solo baja la imagen: no compila nada.

**1. Registrá el redirect URI del Pi en Spotify.** Es el paso que más se olvida:
Spotify exige que coincida **exacto**. En el dashboard agregá
`http://raspberrypi.local:3001/auth/callback` (o la IP fija del Pi,
`http://192.168.0.50:3001/auth/callback`). Podés tener varios registrados a la
vez, así que dejá también el de localhost para desarrollar.

**2. En el Pi:**

```bash
mkdir -p ~/synqfy && cd ~/synqfy
curl -O https://raw.githubusercontent.com/tomiBraunn/synqfy/main/synqfy/docker-compose.pi.yml
printf 'SPOTIFY_REDIRECT_URI=http://raspberrypi.local:3001/auth/callback\n' > .env
docker compose -f docker-compose.pi.yml up -d
```

Abrí `http://raspberrypi.local:3001`, cargá Client ID y Secret en la
configuración inicial y conectá Spotify. Las lámparas se eligen después desde la
pestaña **Luces**.

**Actualizar** cuando pushees cambios (esperá a que termine el workflow):

```bash
docker compose -f docker-compose.pi.yml pull && docker compose -f docker-compose.pi.yml up -d
```

> **No expongas el puerto 3001 a internet.** El backend no tiene autenticación:
> cualquiera que lo alcance controla tus luces y tu reproducción. Dejalo en la
> LAN, o poné una VPN (Tailscale) adelante.

La carpeta `./data` del Pi guarda la config y el refresh token de Spotify —
hacele backup y no la subas a ningún lado.

## Desarrollo local

```bash
# Backend (puerto 3001)
cd synqfy/backend
npm install
npm run dev

# Frontend (puerto 5173, proxy al backend)
cd synqfy/frontend
npm install
npm run dev
```

Tests del backend: `cd synqfy/backend && npm test`

## Configuración

Todo se configura desde la UI (botón ⚙️) y se guarda en `backend/data/config.json`
(o el volumen `/data` en Docker). Las credenciales por variable de entorno (ver
`.env.example`) tienen prioridad sobre lo guardado; las de lámparas
(`HA_ENTITY_IDS_*`) solo siembran el primer arranque, para que elegirlas desde
la página no se deshaga solo.

El token de Home Assistant y el client secret **no se devuelven nunca** por la
API: `GET /api/settings` los manda vacíos con un flag de "ya configurado", y al
guardar, un campo vacío mantiene el valor anterior.

## Roadmap

- Versión hostada multi-usuario (cuentas + HA expuesto vía Nabu Casa/URL pública)

## Licencia

MIT — ver [LICENSE](LICENSE).
