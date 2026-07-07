# chromacast

![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Spotify](https://img.shields.io/badge/Spotify-1DB954?logo=spotify&logoColor=white)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-41BDF5?logo=homeassistant&logoColor=white)

> Sync your Home Assistant lights with the cover art colors of your current Spotify track.

![Demo](./demo.gif)

## Quick Start

```bash
# 1. Clone and install dependencies
git clone <repo-url> && cd chromacast
cd backend && npm install && cd ../frontend && npm install && cd ..

# 2. Copy and fill environment variables
cp .env.example backend/.env

# 3. Start both servers
cd backend && npm run dev &
cd frontend && npm run dev

# 4. Open http://localhost:5173

# 5. Click "Connect with Spotify"
```

## Setup Spotify

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3001/auth/callback` to the Redirect URIs
4. Copy the Client ID and Client Secret to `backend/.env`
5. Make sure your app has the **Web API** enabled

Required scopes:
- `user-read-currently-playing`
- `user-read-playback-state`

## Setup Home Assistant

1. Go to your Home Assistant instance → Profile → Long-Lived Access Tokens
2. Create a new token
3. Copy the token to `HA_TOKEN` in `backend/.env`
4. Set `HA_ENTITY_IDS` to your light entities (e.g., `light.sala,light.cocina`)
5. Set `HA_URL` to your Home Assistant URL

## Mock Mode

No Home Assistant? No problem. chromacast works in **Mock mode** by default.

When `HA_TOKEN` is empty or you toggle to Mock in the UI, a virtual light on screen glows with the extracted color instead of calling Home Assistant.

## How it works

1. OAuth connects your Spotify account
2. Every 3 seconds the app polls `/api/now-playing`
3. When a new track is detected, `node-vibrant` extracts 5 dominant colors from the cover art
4. The best color for lighting is selected (Vibrant → DarkVibrant → Muted → white)
5. If HA mode is on, the color is sent to your light with a smooth 1.5s transition
