# synqfy

Sincroniza tus luces de Home Assistant con lo que suena en Spotify. El backend
extrae la paleta de colores de la portada del álbum y la proyecta en tus luces;
la UI muestra la portada sobre un fondo blureado, con reproductor, letras
sincronizadas, cola e historial.

## Features

- 🎨 Colores de las luces extraídos de la portada del álbum (node-vibrant)
- 💡 Automatización server-side: funciona aunque cierres el navegador
- ⏸️ Al pausar: vuelve a un color base o apaga las luces (tiempo configurable)
- 🎉 Modo fiesta: rotación de colores de la paleta
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
(o el volumen `/data` en Docker). Las variables de entorno (ver `.env.example`)
tienen prioridad sobre lo guardado.

## Roadmap

- Versión hostada multi-usuario (cuentas + HA expuesto vía Nabu Casa/URL pública)

## Licencia

MIT — ver [LICENSE](LICENSE).
