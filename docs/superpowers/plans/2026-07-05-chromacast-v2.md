# chromacast v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir chromacast en una app open-source self-hosteable donde el backend es el cerebro de la automatización de luces (pausa, fiesta, nocturno), con fondo de cover blureada, modal de configuración, letras sincronizadas y modo kiosk.

**Architecture:** El backend Express corre un poller propio contra Spotify (4s) y un motor de automatización server-side; el frontend React pasa a ser vista/control. La configuración se persiste en `backend/data/config.json` con prioridad de variables de entorno. Se empaqueta como un único contenedor Docker.

**Tech Stack:** Node 20, Express 4, TypeScript 5, tsx, vitest (nuevo), React 18, Vite 5, axios, node-vibrant, lrclib.net (API pública sin key), Home Assistant REST API.

**Spec:** `docs/superpowers/specs/2026-07-05-chromacast-v2-design.md`

## Global Constraints

- Sin secretos en el repo: `backend/data/`, `.env` y `node_modules/` gitignoreados.
- Variables de entorno tienen prioridad sobre `config.json` (12-factor).
- Respuesta de `GET /api/settings` NUNCA incluye `spotifyRefreshToken`.
- Shape de respuesta de `GET /api/now-playing` se mantiene retrocompatible (mismos campos de v1) y solo agrega campos nuevos.
- Timeout de requests a HA: 5000ms; a lrclib: 8000ms.
- Brillo: rango 1–255. Volumen: 0–100. Transición: 0–10s.
- Color base al pausar se envía con brillo `min(brillo_actual, 120)` y transición 3s (paridad v1).
- Tests backend con vitest, colocados como `backend/src/**/*.test.ts`.
- El frontend no tiene framework de tests: cada tarea frontend se verifica con `npm run build` (typecheck) + verificación manual en dev server.
- Working directory de todos los comandos: raíz del workspace `c:\Users\tomas\Documents\GitHub\Sync&mix` salvo indicación; los comandos npm corren en `chromacast/backend` o `chromacast/frontend`.
- Commits con mensajes convencionales (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).

---

### Task 1: Repo git + baseline

**Files:**
- Create: `.gitignore` (raíz del workspace)
- Ya existe: `chromacast/.gitignore` (se conserva)

**Interfaces:**
- Consumes: nada.
- Produces: repo git inicializado en la raíz del workspace con baseline commiteado; todas las tareas siguientes commitean acá.

- [ ] **Step 1: Crear `.gitignore` raíz**

```gitignore
node_modules/
dist/
.env
chromacast/backend/data/
*.log
```

- [ ] **Step 2: Inicializar repo y commit baseline**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git init -b main
git add .
git commit -m "chore: baseline chromacast v1 + spec v2"
```

Expected: commit creado sin archivos de `node_modules` (verificar con `git show --stat HEAD | head -50` que no aparezca `node_modules`).

---

### Task 2: Módulo de settings persistido (backend)

**Files:**
- Create: `chromacast/backend/src/settings.ts`
- Create: `chromacast/backend/src/settings.test.ts`
- Modify: `chromacast/backend/package.json` (agregar vitest + script test)

**Interfaces:**
- Consumes: nada nuevo.
- Produces (usado por Tasks 3–7):
  - `interface NightMode { enabled: boolean; start: string; end: string; maxBrightness: number }`
  - `interface AppSettings { spotifyClientId: string; spotifyClientSecret: string; spotifyRedirectUri: string; haUrl: string; haToken: string; primaryEntityIds: string[]; secondaryEntityIds: string[]; defaultColor: [number, number, number]; pauseTimeoutSec: number; pauseAction: "baseColor" | "off"; partySpeedSec: number; nightMode: NightMode; lightsEnabled: boolean; spotifyRefreshToken: string }`
  - `DEFAULT_SETTINGS: AppSettings`
  - `loadSettings(): void` — lee `config.json` del data dir (crea defaults si no existe)
  - `getSettings(): AppSettings` — copia con overrides de env aplicados
  - `updateSettings(patch: Partial<AppSettings>): AppSettings` — merge + persistencia atómica, devuelve `getSettings()`
  - `isConfigured(): boolean`
  - `resetSettingsForTest(): void` — vuelve al default en memoria (solo tests)

- [ ] **Step 1: Instalar vitest y agregar script**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/backend"
npm install -D vitest
```

En `chromacast/backend/package.json`, dentro de `"scripts"`, agregar:

```json
"test": "vitest run"
```

Y en `chromacast/backend/tsconfig.json` cambiar la línea de `exclude` para que los tests no terminen en `dist/` al buildear:

```json
"exclude": ["node_modules", "dist", "src/**/*.test.ts"]
```

- [ ] **Step 2: Escribir el test que falla**

`chromacast/backend/src/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  getSettings,
  updateSettings,
  isConfigured,
  resetSettingsForTest,
} from "./settings";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromacast-test-"));
  process.env.DATA_DIR = tmpDir;
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.HA_URL;
  resetSettingsForTest();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.HA_URL;
});

describe("settings", () => {
  it("devuelve defaults cuando no hay archivo", () => {
    loadSettings();
    expect(getSettings().pauseTimeoutSec).toBe(5);
    expect(getSettings().pauseAction).toBe("baseColor");
    expect(getSettings().defaultColor).toEqual([255, 200, 150]);
    expect(getSettings().nightMode.enabled).toBe(false);
    expect(isConfigured()).toBe(false);
  });

  it("persiste updates y los recupera con loadSettings", () => {
    loadSettings();
    updateSettings({ pauseTimeoutSec: 12, pauseAction: "off", lightsEnabled: true });
    resetSettingsForTest();
    loadSettings();
    expect(getSettings().pauseTimeoutSec).toBe(12);
    expect(getSettings().pauseAction).toBe("off");
    expect(getSettings().lightsEnabled).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "config.json"), "utf8"));
    expect(onDisk.pauseTimeoutSec).toBe(12);
  });

  it("mergea nightMode parcialmente", () => {
    loadSettings();
    updateSettings({ nightMode: { ...DEFAULT_SETTINGS.nightMode, enabled: true, maxBrightness: 60 } });
    expect(getSettings().nightMode.enabled).toBe(true);
    expect(getSettings().nightMode.maxBrightness).toBe(60);
    expect(getSettings().nightMode.start).toBe("23:00");
  });

  it("las env vars tienen prioridad sobre lo guardado", () => {
    loadSettings();
    updateSettings({ spotifyClientId: "guardado", haUrl: "http://guardado:8123" });
    process.env.SPOTIFY_CLIENT_ID = "de-env";
    process.env.HA_URL = "http://de-env:8123";
    expect(getSettings().spotifyClientId).toBe("de-env");
    expect(getSettings().haUrl).toBe("http://de-env:8123");
  });

  it("isConfigured true con credenciales spotify", () => {
    loadSettings();
    updateSettings({
      spotifyClientId: "a",
      spotifyClientSecret: "b",
      spotifyRedirectUri: "http://localhost:3001/auth/callback",
    });
    expect(isConfigured()).toBe(true);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/backend"
npx vitest run src/settings.test.ts
```

Expected: FAIL — `Cannot find module './settings'` (o equivalente).

- [ ] **Step 4: Implementar `settings.ts`**

`chromacast/backend/src/settings.ts`:

```ts
import fs from "fs";
import path from "path";

export interface NightMode {
  enabled: boolean;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  maxBrightness: number; // 1-255
}

export interface AppSettings {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  haUrl: string;
  haToken: string;
  primaryEntityIds: string[];
  secondaryEntityIds: string[];
  defaultColor: [number, number, number];
  pauseTimeoutSec: number;
  pauseAction: "baseColor" | "off";
  partySpeedSec: number;
  nightMode: NightMode;
  lightsEnabled: boolean;
  spotifyRefreshToken: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  spotifyClientId: "",
  spotifyClientSecret: "",
  spotifyRedirectUri: "",
  haUrl: "",
  haToken: "",
  primaryEntityIds: [],
  secondaryEntityIds: [],
  defaultColor: [255, 200, 150],
  pauseTimeoutSec: 5,
  pauseAction: "baseColor",
  partySpeedSec: 8,
  nightMode: { enabled: false, start: "23:00", end: "07:00", maxBrightness: 80 },
  lightsEnabled: false,
  spotifyRefreshToken: "",
};

let settings: AppSettings = structuredClone(DEFAULT_SETTINGS);

function dataDir(): string {
  return process.env.DATA_DIR || path.resolve(__dirname, "../data");
}

function configFile(): string {
  return path.join(dataDir(), "config.json");
}

export function loadSettings(): void {
  try {
    const raw = fs.readFileSync(configFile(), "utf8");
    const parsed = JSON.parse(raw);
    settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      nightMode: { ...DEFAULT_SETTINGS.nightMode, ...(parsed.nightMode ?? {}) },
    };
  } catch {
    settings = structuredClone(DEFAULT_SETTINGS);
  }
}

function persist(): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = configFile() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
  fs.renameSync(tmp, configFile());
}

function parseIds(env: string | undefined): string[] {
  return (env || "").split(",").map(s => s.trim()).filter(Boolean);
}

const ENV_STRING_OVERRIDES: [keyof AppSettings, string][] = [
  ["spotifyClientId", "SPOTIFY_CLIENT_ID"],
  ["spotifyClientSecret", "SPOTIFY_CLIENT_SECRET"],
  ["spotifyRedirectUri", "SPOTIFY_REDIRECT_URI"],
  ["haUrl", "HA_URL"],
  ["haToken", "HA_TOKEN"],
];

export function getSettings(): AppSettings {
  const out: AppSettings = {
    ...settings,
    nightMode: { ...settings.nightMode },
    defaultColor: [...settings.defaultColor] as [number, number, number],
    primaryEntityIds: [...settings.primaryEntityIds],
    secondaryEntityIds: [...settings.secondaryEntityIds],
  };
  for (const [key, envName] of ENV_STRING_OVERRIDES) {
    const v = process.env[envName];
    if (v) (out as Record<keyof AppSettings, unknown>)[key] = v;
  }
  if (process.env.HA_ENTITY_IDS_PRIMARY) {
    out.primaryEntityIds = parseIds(process.env.HA_ENTITY_IDS_PRIMARY);
  }
  if (process.env.HA_ENTITY_IDS_SECONDARY) {
    out.secondaryEntityIds = parseIds(process.env.HA_ENTITY_IDS_SECONDARY);
  }
  return out;
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  settings = {
    ...settings,
    ...patch,
    nightMode: { ...settings.nightMode, ...(patch.nightMode ?? {}) },
  };
  persist();
  return getSettings();
}

export function isConfigured(): boolean {
  const s = getSettings();
  return !!(s.spotifyClientId && s.spotifyClientSecret && s.spotifyRedirectUri);
}

export function resetSettingsForTest(): void {
  settings = structuredClone(DEFAULT_SETTINGS);
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
npx vitest run src/settings.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/backend/src/settings.ts chromacast/backend/src/settings.test.ts chromacast/backend/package.json chromacast/backend/package-lock.json
git commit -m "feat(backend): settings persistido con prioridad de env vars"
```

---

### Task 3: Migrar consumidores a settings + rutas /api/settings + persistir refresh token

**Files:**
- Modify: `chromacast/backend/src/services/spotify.ts`
- Modify: `chromacast/backend/src/services/homeassistant.ts`
- Modify: `chromacast/backend/src/routes/auth.ts`
- Modify: `chromacast/backend/src/routes/config.ts`
- Create: `chromacast/backend/src/routes/settings.ts`
- Modify: `chromacast/backend/src/index.ts`
- Delete: `chromacast/backend/src/config.ts`

**Interfaces:**
- Consumes: `getSettings()`, `updateSettings()`, `isConfigured()`, `loadSettings()` de Task 2.
- Produces:
  - `GET /api/settings` → `AppSettings` sin `spotifyRefreshToken`.
  - `PUT /api/settings` body `Partial<AppSettings>` → mismo shape que el GET.
  - En `services/spotify.ts`: `restoreSessionFromRefreshToken(): Promise<boolean>` (usa el refresh token persistido al bootear).
  - `setToken()` ahora persiste `spotifyRefreshToken` vía `updateSettings`.

- [ ] **Step 1: Reemplazar imports de config por settings**

En `chromacast/backend/src/services/spotify.ts` reemplazar el import y `getClientCredentials`:

```ts
import { getSettings, updateSettings } from "../settings";

function getClientCredentials() {
  const s = getSettings();
  return { clientId: s.spotifyClientId, clientSecret: s.spotifyClientSecret };
}
```

En el mismo archivo, modificar `setToken` y agregar `restoreSessionFromRefreshToken` después de `getToken`:

```ts
export function setToken(accessToken: string, refreshToken: string, expiresIn: number): void {
  token = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + expiresIn * 1000,
  };
  updateSettings({ spotifyRefreshToken: refreshToken });
}

export async function restoreSessionFromRefreshToken(): Promise<boolean> {
  const saved = getSettings().spotifyRefreshToken;
  if (!saved) return false;
  token = { access_token: "", refresh_token: saved, expires_at: 0 };
  try {
    await refreshAccessToken();
    return true;
  } catch {
    token = null;
    return false;
  }
}
```

Y en `refreshAccessToken`, después de la línea `token!.refresh_token = res.data.refresh_token;` agregar (dentro del mismo `if`):

```ts
    updateSettings({ spotifyRefreshToken: res.data.refresh_token });
```

- [ ] **Step 2: Migrar `homeassistant.ts` a settings**

Reemplazar en `chromacast/backend/src/services/homeassistant.ts` el import de config y el comienzo de `updateLights` (hasta la línea `const allIds = ...` inclusive) por:

```ts
import { getSettings } from "../settings";

export interface LightUpdateOptions {
  brightness?: number;
  transition?: number;
  colorOverride?: [number, number, number];
  primaryColorOverride?: [number, number, number];
  secondaryColorOverride?: [number, number, number];
}

export async function updateLights(
  primaryColor: [number, number, number],
  secondaryColor: [number, number, number],
  options: LightUpdateOptions = {}
): Promise<void> {
  const s = getSettings();
  const haUrl = s.haUrl;
  const haToken = s.haToken;

  if (!haUrl || !haToken) {
    throw new Error("Home Assistant is not configured");
  }

  const primaryIds = s.primaryEntityIds;
  const secondaryIds = s.secondaryEntityIds;
  const allIds: string[] = [];
```

(la función `parseIds` local de ese archivo se elimina; el resto de `updateLights` y `sendColor` quedan igual).

- [ ] **Step 3: Migrar `routes/auth.ts` y `routes/config.ts`**

En `chromacast/backend/src/routes/auth.ts`, reemplazar el import de config y `getCredentials`:

```ts
import { getSettings } from "../settings";

function getCredentials() {
  const s = getSettings();
  return {
    clientId: s.spotifyClientId,
    clientSecret: s.spotifyClientSecret,
    redirectUri: s.spotifyRedirectUri,
  };
}
```

Reescribir `chromacast/backend/src/routes/config.ts` completo (mantiene el contrato v1 del primer arranque, ahora persistiendo):

```ts
import { Router, Request, Response } from "express";
import { updateSettings, isConfigured } from "../settings";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({ configured: isConfigured() });
});

router.post("/", (req: Request, res: Response) => {
  const {
    spotifyClientId,
    spotifyClientSecret,
    spotifyRedirectUri,
    haUrl = "",
    haToken = "",
    primaryEntityIds = "",
    secondaryEntityIds = "",
  } = req.body;

  if (!spotifyClientId || !spotifyClientSecret || !spotifyRedirectUri) {
    res.status(400).json({ error: "Spotify Client ID, Secret and Redirect URI are required" });
    return;
  }

  updateSettings({
    spotifyClientId,
    spotifyClientSecret,
    spotifyRedirectUri,
    haUrl,
    haToken,
    primaryEntityIds: primaryEntityIds.split(",").map((s: string) => s.trim()).filter(Boolean),
    secondaryEntityIds: secondaryEntityIds.split(",").map((s: string) => s.trim()).filter(Boolean),
  });

  res.json({ success: true });
});

export default router;
```

- [ ] **Step 4: Crear `routes/settings.ts`**

```ts
import { Router, Request, Response } from "express";
import { getSettings, updateSettings, AppSettings } from "../settings";

const router = Router();

function publicSettings() {
  const s: Record<string, unknown> = { ...getSettings() };
  delete s.spotifyRefreshToken;
  return s;
}

router.get("/", (_req: Request, res: Response) => {
  res.json(publicSettings());
});

router.put("/", (req: Request, res: Response) => {
  const patch = { ...(req.body as Partial<AppSettings>) };
  delete (patch as Record<string, unknown>).spotifyRefreshToken;
  if (patch.pauseTimeoutSec !== undefined) {
    patch.pauseTimeoutSec = Math.max(1, Math.min(600, Number(patch.pauseTimeoutSec)));
  }
  if (patch.partySpeedSec !== undefined) {
    patch.partySpeedSec = Math.max(2, Math.min(120, Number(patch.partySpeedSec)));
  }
  if (patch.pauseAction !== undefined && patch.pauseAction !== "baseColor" && patch.pauseAction !== "off") {
    res.status(400).json({ error: "pauseAction must be 'baseColor' or 'off'" });
    return;
  }
  updateSettings(patch);
  res.json(publicSettings());
});

export default router;
```

- [ ] **Step 5: Wire en `index.ts`, borrar `config.ts`, restaurar sesión al boot**

En `chromacast/backend/src/index.ts` agregar imports y wiring (después de los imports existentes y de `app.use("/api", spotifyRoutes);` respectivamente):

```ts
import settingsRoutes from "./routes/settings";
import { loadSettings } from "./settings";
import { restoreSessionFromRefreshToken } from "./services/spotify";
```

```ts
app.use("/api/settings", settingsRoutes);
```

Y antes de `app.listen(...)`:

```ts
loadSettings();
restoreSessionFromRefreshToken().then(restored => {
  if (restored) console.log("Spotify session restored from saved refresh token");
});
```

Verificar que nadie más importa config y borrar:

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/backend"
grep -rn "from \"../config\"\|from \"./config\"" src/ ; echo "exit: $?"
```

Expected: sin matches (exit 1). Luego:

```bash
rm src/config.ts
```

- [ ] **Step 6: Typecheck + tests + prueba manual del boot**

```bash
npx tsc --noEmit
npm test
```

Expected: sin errores de tipos; tests de settings PASS.

```bash
npx tsx src/index.ts &
sleep 3
curl -s http://localhost:3001/api/settings
```

Expected: JSON con defaults y SIN el campo `spotifyRefreshToken`. Matar el proceso después.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add -A chromacast/backend/src
git commit -m "feat(backend): rutas /api/settings, sesion spotify persistida, adios config.ts"
```

---

### Task 4: Lights controller con tope nocturno y apagado

**Files:**
- Modify: `chromacast/backend/src/services/homeassistant.ts` (agregar `turnOffAllLights`)
- Create: `chromacast/backend/src/services/lightsController.ts`
- Create: `chromacast/backend/src/services/lightsController.test.ts`

**Interfaces:**
- Consumes: `updateLights`, `getSettings`, `pickLightColor`, `pickSecondaryColor`, `Palette`.
- Produces (usado por Task 5 y 6):
  - `turnOffAllLights(transition?: number): Promise<void>` en homeassistant.ts
  - `getLightState(): { brightness: number; transition: number; lastError: string | null }`
  - `setBrightness(b: number): void`, `setTransition(t: number): void`
  - `isNightNow(now?: Date): boolean`
  - `cappedBrightness(requested: number, now?: Date): number`
  - `applyColors(primary: [number,number,number], secondary: [number,number,number], opts?: { brightness?: number; transition?: number }): Promise<void>`
  - `applyPalette(palette: Palette): Promise<void>`
  - `applyBaseColor(): Promise<void>`
  - `turnOff(): Promise<void>`

- [ ] **Step 1: Test que falla — lógica nocturna pura**

`chromacast/backend/src/services/lightsController.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { isNightNow, cappedBrightness } from "./lightsController";
import { resetSettingsForTest, updateSettings, DEFAULT_SETTINGS } from "../settings";
import fs from "fs";
import os from "os";
import path from "path";

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2026, 6, 5);
  d.setHours(h, m, 0, 0);
  return d;
}

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "chromacast-lc-"));
  resetSettingsForTest();
});

describe("isNightNow", () => {
  it("false cuando nightMode.enabled es false", () => {
    expect(isNightNow(at("03:00"))).toBe(false);
  });

  it("rango simple 20:00-23:00", () => {
    updateSettings({ nightMode: { ...DEFAULT_SETTINGS.nightMode, enabled: true, start: "20:00", end: "23:00" } });
    expect(isNightNow(at("21:00"))).toBe(true);
    expect(isNightNow(at("19:59"))).toBe(false);
    expect(isNightNow(at("23:00"))).toBe(false);
  });

  it("rango que cruza medianoche 23:00-07:00", () => {
    updateSettings({ nightMode: { ...DEFAULT_SETTINGS.nightMode, enabled: true, start: "23:00", end: "07:00" } });
    expect(isNightNow(at("23:30"))).toBe(true);
    expect(isNightNow(at("03:00"))).toBe(true);
    expect(isNightNow(at("06:59"))).toBe(true);
    expect(isNightNow(at("07:00"))).toBe(false);
    expect(isNightNow(at("12:00"))).toBe(false);
  });
});

describe("cappedBrightness", () => {
  it("no clampa de dia", () => {
    expect(cappedBrightness(255, at("12:00"))).toBe(255);
  });

  it("clampa de noche al maxBrightness", () => {
    updateSettings({
      nightMode: { enabled: true, start: "23:00", end: "07:00", maxBrightness: 60 },
    });
    expect(cappedBrightness(255, at("02:00"))).toBe(60);
    expect(cappedBrightness(40, at("02:00"))).toBe(40);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/backend"
npx vitest run src/services/lightsController.test.ts
```

Expected: FAIL — `Cannot find module './lightsController'`.

- [ ] **Step 3: Agregar `turnOffAllLights` al final de `homeassistant.ts`**

```ts
export async function turnOffAllLights(transition = 3): Promise<void> {
  const s = getSettings();
  if (!s.haUrl || !s.haToken) {
    throw new Error("Home Assistant is not configured");
  }
  const ids = [...s.primaryEntityIds, ...s.secondaryEntityIds];
  if (ids.length === 0) {
    throw new Error("No light entities configured");
  }
  await Promise.all(
    ids.map(id =>
      axios.post(
        `${s.haUrl}/api/services/light/turn_off`,
        { entity_id: id, transition },
        {
          headers: { Authorization: `Bearer ${s.haToken}`, "Content-Type": "application/json" },
          timeout: 5000,
        }
      )
    )
  );
}
```

- [ ] **Step 4: Implementar `lightsController.ts`**

```ts
import { updateLights, turnOffAllLights } from "./homeassistant";
import { getSettings } from "../settings";
import { Palette, pickLightColor, pickSecondaryColor } from "../utils/colors";

interface LightRunState {
  brightness: number;
  transition: number;
  lastError: string | null;
}

const state: LightRunState = { brightness: 255, transition: 1.5, lastError: null };

export function getLightState(): LightRunState {
  return state;
}

export function setBrightness(b: number): void {
  state.brightness = Math.min(255, Math.max(1, b));
}

export function setTransition(t: number): void {
  state.transition = Math.min(10, Math.max(0, t));
}

export function isNightNow(now: Date = new Date()): boolean {
  const { nightMode } = getSettings();
  if (!nightMode.enabled) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = nightMode.start.split(":").map(Number);
  const [eh, em] = nightMode.end.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

export function cappedBrightness(requested: number, now: Date = new Date()): number {
  if (!isNightNow(now)) return requested;
  return Math.min(requested, getSettings().nightMode.maxBrightness);
}

export async function applyColors(
  primary: [number, number, number],
  secondary: [number, number, number],
  opts: { brightness?: number; transition?: number } = {}
): Promise<void> {
  try {
    await updateLights(primary, secondary, {
      brightness: cappedBrightness(opts.brightness ?? state.brightness),
      transition: opts.transition ?? state.transition,
    });
    state.lastError = null;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  }
}

export async function applyPalette(palette: Palette): Promise<void> {
  await applyColors(pickLightColor(palette), pickSecondaryColor(palette));
}

export async function applyBaseColor(): Promise<void> {
  const { defaultColor } = getSettings();
  await applyColors(defaultColor, defaultColor, {
    brightness: Math.min(state.brightness, 120),
    transition: 3,
  });
}

export async function turnOff(): Promise<void> {
  try {
    await turnOffAllLights(3);
    state.lastError = null;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  }
}
```

- [ ] **Step 5: Correr tests y typecheck**

```bash
npx vitest run src/services/lightsController.test.ts
npx tsc --noEmit
```

Expected: PASS (5 tests), sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/backend/src/services
git commit -m "feat(backend): lights controller con tope nocturno y turn_off"
```

---

### Task 5: Motor de automatización (pausa, reanudar, fiesta)

**Files:**
- Create: `chromacast/backend/src/services/automation.ts`
- Create: `chromacast/backend/src/services/automation.test.ts`

**Interfaces:**
- Consumes: `applyPalette`, `applyColors`, `applyBaseColor`, `turnOff` (Task 4); `getSettings`, `updateSettings` (Task 2); `Palette`.
- Produces (usado por Task 6):
  - `onTrackChange(palette: Palette | null): void`
  - `onPlayStateChange(isPlaying: boolean): void`
  - `setPartyMode(on: boolean): void`
  - `getAutomationState(): { partyOn: boolean; pauseActionDone: boolean }`
  - `resetAutomationForTest(): void`

- [ ] **Step 1: Test que falla**

`chromacast/backend/src/services/automation.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("./lightsController", () => ({
  applyPalette: vi.fn().mockResolvedValue(undefined),
  applyColors: vi.fn().mockResolvedValue(undefined),
  applyBaseColor: vi.fn().mockResolvedValue(undefined),
  turnOff: vi.fn().mockResolvedValue(undefined),
}));

import { applyPalette, applyColors, applyBaseColor, turnOff } from "./lightsController";
import {
  onTrackChange,
  onPlayStateChange,
  setPartyMode,
  getAutomationState,
  resetAutomationForTest,
} from "./automation";
import { resetSettingsForTest, updateSettings } from "../settings";
import type { Palette } from "../utils/colors";

const PALETTE: Palette = {
  Vibrant: [200, 30, 30],
  DarkVibrant: [80, 10, 10],
  Muted: [120, 100, 90],
  DarkMuted: [60, 50, 45],
  LightVibrant: [250, 180, 180],
};

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "chromacast-auto-"));
  vi.useFakeTimers();
  resetSettingsForTest();
  resetAutomationForTest();
  updateSettings({ lightsEnabled: true, pauseTimeoutSec: 5, partySpeedSec: 8 });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pausa", () => {
  it("ejecuta color base a los pauseTimeoutSec de pausar", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    expect(applyBaseColor).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(applyBaseColor).toHaveBeenCalledTimes(1);
    expect(getAutomationState().pauseActionDone).toBe(true);
  });

  it("apaga las luces cuando pauseAction es off", () => {
    updateSettings({ pauseAction: "off" });
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(5000);
    expect(turnOff).toHaveBeenCalledTimes(1);
    expect(applyBaseColor).not.toHaveBeenCalled();
  });

  it("cancela el timer si se reanuda antes del timeout", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(3000);
    onPlayStateChange(true);
    vi.advanceTimersByTime(10000);
    expect(applyBaseColor).not.toHaveBeenCalled();
  });

  it("restaura la paleta del track al reanudar despues del timeout", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(5000);
    vi.clearAllMocks();
    onPlayStateChange(true);
    expect(applyPalette).toHaveBeenCalledWith(PALETTE);
    expect(getAutomationState().pauseActionDone).toBe(false);
  });

  it("no hace nada con lightsEnabled false", () => {
    updateSettings({ lightsEnabled: false });
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(60000);
    expect(applyBaseColor).not.toHaveBeenCalled();
    expect(turnOff).not.toHaveBeenCalled();
  });
});

describe("cambio de track", () => {
  it("aplica la paleta si las luces estan activadas", () => {
    onPlayStateChange(true);
    onTrackChange(PALETTE);
    expect(applyPalette).toHaveBeenCalledWith(PALETTE);
  });

  it("no aplica nada con luces desactivadas", () => {
    updateSettings({ lightsEnabled: false });
    onTrackChange(PALETTE);
    expect(applyPalette).not.toHaveBeenCalled();
  });
});

describe("modo fiesta", () => {
  it("rota colores cada partySpeedSec mientras suena", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    vi.clearAllMocks();
    setPartyMode(true);
    expect(applyColors).toHaveBeenCalledTimes(1); // tick inmediato
    vi.advanceTimersByTime(8000);
    expect(applyColors).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(16000);
    expect(applyColors).toHaveBeenCalledTimes(4);
  });

  it("se detiene al pausar y se retoma al reanudar", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    setPartyMode(true);
    vi.clearAllMocks();
    onPlayStateChange(false);
    vi.advanceTimersByTime(24000);
    expect(applyColors).not.toHaveBeenCalled();
    onPlayStateChange(true);
    vi.advanceTimersByTime(8000);
    expect(applyColors).toHaveBeenCalled();
  });

  it("al apagarlo vuelve a la paleta del track", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    setPartyMode(true);
    vi.clearAllMocks();
    setPartyMode(false);
    expect(getAutomationState().partyOn).toBe(false);
    expect(applyPalette).toHaveBeenCalledWith(PALETTE);
    vi.advanceTimersByTime(30000);
    expect(applyColors).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/backend"
npx vitest run src/services/automation.test.ts
```

Expected: FAIL — `Cannot find module './automation'`.

- [ ] **Step 3: Implementar `automation.ts`**

```ts
import { getSettings } from "../settings";
import { applyPalette, applyColors, applyBaseColor, turnOff } from "./lightsController";
import type { Palette } from "../utils/colors";

let currentPalette: Palette | null = null;
let playing = false;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let pauseActionDone = false;
let partyOn = false;
let partyTimer: ReturnType<typeof setInterval> | null = null;
let partyIndex = 0;

const PARTY_KEYS: (keyof Palette)[] = [
  "Vibrant",
  "LightVibrant",
  "Muted",
  "DarkVibrant",
  "DarkMuted",
];

export function getAutomationState(): { partyOn: boolean; pauseActionDone: boolean } {
  return { partyOn, pauseActionDone };
}

function clearPauseTimer(): void {
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
}

function stopPartyTimer(): void {
  if (partyTimer) {
    clearInterval(partyTimer);
    partyTimer = null;
  }
}

function partyTick(): void {
  if (!currentPalette) return;
  const colors = PARTY_KEYS
    .map(k => currentPalette![k])
    .filter((c): c is [number, number, number] => c !== null);
  if (colors.length === 0) return;
  const primary = colors[partyIndex % colors.length];
  const secondary = colors[(partyIndex + 1) % colors.length];
  partyIndex++;
  void applyColors(primary, secondary);
}

function startPartyTimer(): void {
  stopPartyTimer();
  partyTick();
  partyTimer = setInterval(partyTick, getSettings().partySpeedSec * 1000);
}

export function onTrackChange(palette: Palette | null): void {
  currentPalette = palette;
  partyIndex = 0;
  if (!getSettings().lightsEnabled || !palette) return;
  if (!partyOn && !pauseActionDone) {
    void applyPalette(palette);
  }
}

export function onPlayStateChange(isPlaying: boolean): void {
  if (isPlaying === playing) return;
  playing = isPlaying;

  if (isPlaying) {
    clearPauseTimer();
    if (getSettings().lightsEnabled) {
      if (pauseActionDone) {
        pauseActionDone = false;
        if (currentPalette && !partyOn) void applyPalette(currentPalette);
      }
      if (partyOn) startPartyTimer();
    } else {
      pauseActionDone = false;
    }
    return;
  }

  stopPartyTimer();
  if (!getSettings().lightsEnabled) return;
  clearPauseTimer();
  pauseTimer = setTimeout(() => {
    pauseActionDone = true;
    if (getSettings().pauseAction === "off") void turnOff();
    else void applyBaseColor();
  }, getSettings().pauseTimeoutSec * 1000);
}

export function setPartyMode(on: boolean): void {
  partyOn = on;
  if (on) {
    if (playing && getSettings().lightsEnabled) startPartyTimer();
    return;
  }
  stopPartyTimer();
  if (currentPalette && getSettings().lightsEnabled && !pauseActionDone) {
    void applyPalette(currentPalette);
  }
}

export function resetAutomationForTest(): void {
  clearPauseTimer();
  stopPartyTimer();
  currentPalette = null;
  playing = false;
  pauseActionDone = false;
  partyOn = false;
  partyIndex = 0;
}
```

- [ ] **Step 4: Correr tests**

```bash
npx vitest run src/services/automation.test.ts
npm test
```

Expected: PASS todos (automation 10 tests + settings + lightsController).

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/backend/src/services/automation.ts chromacast/backend/src/services/automation.test.ts
git commit -m "feat(backend): motor de automatizacion (pausa, reanudar, modo fiesta)"
```

---

### Task 6: Poller server-side + rutas servidas desde cache

**Files:**
- Create: `chromacast/backend/src/services/poller.ts`
- Modify: `chromacast/backend/src/routes/spotify.ts` (reescritura)
- Modify: `chromacast/backend/src/index.ts`

**Interfaces:**
- Consumes: `getNowPlaying`, `isAuthenticated` (spotify service); `extractPalette`; `addToHistory`; `onTrackChange`, `onPlayStateChange`, `setPartyMode`, `getAutomationState` (Task 5); `getLightState`, `setBrightness`, `setTransition`, `applyColors`, `isNightNow` (Task 4); `getSettings`, `updateSettings`.
- Produces:
  - `interface PlayerSnapshot { playing: boolean; id?: string; track?: string; artist?: string; album?: string; coverUrl?: string; isPlaying?: boolean; progressMs?: number; durationMs?: number; volume?: number; palette?: Palette | null; fetchedAt: number; error?: string | null }`
  - `getSnapshot(): PlayerSnapshot`, `pollOnce(): Promise<void>`, `startPoller(intervalMs?: number): void`, `stopPoller(): void`
  - `GET /api/now-playing` sirve el snapshot + `lightsError`, `night`, `party` (campos nuevos).
  - `POST /api/lights/party` body `{ on: boolean }` → `{ success: true, party: boolean }`.

- [ ] **Step 1: Implementar `poller.ts`**

```ts
import { getNowPlaying, isAuthenticated } from "./spotify";
import { extractPalette, Palette } from "../utils/colors";
import { addToHistory } from "../store";
import { onTrackChange, onPlayStateChange } from "./automation";

export interface PlayerSnapshot {
  playing: boolean;
  id?: string;
  track?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  isPlaying?: boolean;
  progressMs?: number;
  durationMs?: number;
  volume?: number;
  palette?: Palette | null;
  fetchedAt: number;
  error?: string | null;
}

let snapshot: PlayerSnapshot = { playing: false, fetchedAt: 0, error: null };
let lastTrackId: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let polling = false;

export function getSnapshot(): PlayerSnapshot {
  return snapshot;
}

export async function pollOnce(): Promise<void> {
  if (polling || !isAuthenticated()) return;
  polling = true;
  try {
    const data = await getNowPlaying();

    if (!data) {
      snapshot = { playing: false, fetchedAt: Date.now(), error: null };
      lastTrackId = null;
      onPlayStateChange(false);
      return;
    }

    let palette = snapshot.palette ?? null;
    if (data.id !== lastTrackId) {
      lastTrackId = data.id;
      palette = await extractPalette(data.coverUrl).catch(() => null);
      if (palette) {
        addToHistory({
          id: data.id,
          track: data.track,
          artist: data.artist,
          album: data.album,
          coverUrl: data.coverUrl,
          playedAt: Date.now(),
          palette,
        });
      }
      onTrackChange(palette);
    }

    snapshot = { playing: true, ...data, palette, fetchedAt: Date.now(), error: null };
    onPlayStateChange(data.isPlaying);
  } catch (err) {
    snapshot = {
      ...snapshot,
      fetchedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    polling = false;
  }
}

export function startPoller(intervalMs = 4000): void {
  if (timer) return;
  void pollOnce();
  timer = setInterval(() => void pollOnce(), intervalMs);
}

export function stopPoller(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
```

- [ ] **Step 2: Reescribir `routes/spotify.ts`**

Reemplazar el archivo completo por:

```ts
import { Router, Request, Response } from "express";
import {
  pausePlayback,
  resumePlayback,
  skipToNext,
  skipToPrevious,
  setVolume,
  seekToPosition,
  getQueue,
} from "../services/spotify";
import { getSnapshot, pollOnce } from "../services/poller";
import {
  getLightState,
  setBrightness,
  setTransition,
  applyColors,
  isNightNow,
} from "../services/lightsController";
import { setPartyMode, getAutomationState } from "../services/automation";
import { getHistory, PRESETS } from "../store";
import { pickLightColor, pickSecondaryColor } from "../utils/colors";

const router = Router();
let activePreset: string | null = null;

router.get("/now-playing", (_req: Request, res: Response) => {
  const snap = getSnapshot();
  const light = getLightState();
  const auto = getAutomationState();

  if (!snap.playing) {
    res.json({
      playing: false,
      lightsError: light.lastError,
      night: isNightNow(),
      party: auto.partyOn,
    });
    return;
  }

  res.json({
    playing: true,
    id: snap.id,
    track: snap.track,
    artist: snap.artist,
    album: snap.album,
    coverUrl: snap.coverUrl,
    isPlaying: snap.isPlaying,
    progressMs: snap.progressMs,
    durationMs: snap.durationMs,
    volume: snap.volume,
    palette: snap.palette,
    lightsError: light.lastError,
    night: isNightNow(),
    party: auto.partyOn,
  });
});

router.post("/lights/update", async (req: Request, res: Response) => {
  const palette = getSnapshot().palette;
  if (!palette) {
    res.status(400).json({ error: "No palette available yet" });
    return;
  }
  const { brightness, transition, primaryColor, secondaryColor } = req.body || {};
  if (typeof brightness === "number") setBrightness(brightness);
  if (typeof transition === "number") setTransition(transition);

  const primary = (primaryColor as [number, number, number]) ?? pickLightColor(palette);
  const secondary = (secondaryColor as [number, number, number]) ?? pickSecondaryColor(palette);

  await applyColors(primary, secondary);
  const light = getLightState();
  res.json({
    success: light.lastError === null,
    error: light.lastError ?? undefined,
    primary,
    secondary,
    brightness: light.brightness,
    transition: light.transition,
  });
});

router.post("/lights/party", (req: Request, res: Response) => {
  const { on } = req.body || {};
  if (typeof on !== "boolean") {
    res.status(400).json({ error: "on (boolean) required" });
    return;
  }
  setPartyMode(on);
  res.json({ success: true, party: getAutomationState().partyOn });
});

router.post("/lights/brightness", (req: Request, res: Response) => {
  const { brightness } = req.body;
  if (typeof brightness !== "number") {
    res.status(400).json({ error: "brightness (number) required" });
    return;
  }
  setBrightness(brightness);
  res.json({ success: true, brightness: getLightState().brightness });
});

router.post("/lights/transition", (req: Request, res: Response) => {
  const { transition } = req.body;
  if (typeof transition !== "number") {
    res.status(400).json({ error: "transition (number) required" });
    return;
  }
  setTransition(transition);
  res.json({ success: true, transition: getLightState().transition });
});

router.get("/lights/presets", (_req: Request, res: Response) => {
  res.json({ presets: PRESETS, active: activePreset });
});

router.post("/lights/preset", async (req: Request, res: Response) => {
  const { name } = req.body;
  const preset = PRESETS.find(p => p.name === name);
  if (!preset) {
    res.status(400).json({ error: "Unknown preset" });
    return;
  }
  activePreset = name;
  setBrightness(preset.brightness);
  setTransition(preset.transition);

  const palette = getSnapshot().palette;
  if (!palette) {
    res.json({ success: true, preset: name, brightness: preset.brightness, transition: preset.transition });
    return;
  }
  const paletteAny = palette as unknown as Record<string, [number, number, number] | null>;
  const primary = paletteAny[preset.primarySource] ?? pickLightColor(palette);
  const secondary = paletteAny[preset.secondarySource] ?? pickSecondaryColor(palette);
  await applyColors(primary, secondary);
  const light = getLightState();
  res.json({
    success: light.lastError === null,
    error: light.lastError ?? undefined,
    preset: name,
    brightness: light.brightness,
    transition: light.transition,
  });
});

router.get("/history", (_req: Request, res: Response) => {
  res.json({ history: getHistory() });
});

router.get("/player/queue", async (_req: Request, res: Response) => {
  try {
    const queue = await getQueue();
    res.json(queue);
  } catch (err: any) {
    console.error("Queue error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

router.put("/player/volume", async (req: Request, res: Response) => {
  const { volume } = req.body;
  if (typeof volume !== "number") {
    res.status(400).json({ error: "volume (number 0-100) required" });
    return;
  }
  try {
    await setVolume(volume);
    res.json({ success: true, volume });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

router.put("/player/seek", async (req: Request, res: Response) => {
  const { positionMs } = req.body;
  if (typeof positionMs !== "number") {
    res.status(400).json({ error: "positionMs (number) required" });
    return;
  }
  try {
    await seekToPosition(positionMs);
    void pollOnce();
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

function playerAction(fn: () => Promise<void>) {
  return async (_req: Request, res: Response) => {
    try {
      await fn();
      void pollOnce();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Player action error:", err.response?.data || err.message);
      res.json({ success: false, error: err.message });
    }
  };
}

router.post("/player/next", playerAction(skipToNext));
router.post("/player/previous", playerAction(skipToPrevious));
router.post("/player/pause", playerAction(pausePlayback));
router.post("/player/play", playerAction(resumePlayback));

export default router;
```

Nota: los endpoints `GET/POST /lights/default-color` desaparecen (absorbidos por `/api/settings`); el frontend se actualiza en Task 9/10.

- [ ] **Step 3: Arrancar el poller en `index.ts`**

Agregar import y arranque (después de `restoreSessionFromRefreshToken().then(...)`):

```ts
import { startPoller } from "./services/poller";
```

```ts
startPoller();
```

- [ ] **Step 4: Typecheck + tests + humo manual**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/backend"
npx tsc --noEmit
npm test
```

Expected: sin errores; todos los tests PASS.

Humo manual (sin credenciales reales el poller queda idle, no debe crashear):

```bash
npx tsx src/index.ts &
sleep 5
curl -s http://localhost:3001/api/now-playing
```

Expected: `{"playing":false,"lightsError":null,"night":false,"party":false}` y ningún error en consola. Matar el proceso.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/backend/src
git commit -m "feat(backend): poller server-side, now-playing desde cache, endpoint party"
```

---

### Task 7: Servicio de letras (lrclib) + ruta

**Files:**
- Create: `chromacast/backend/src/services/lyrics.ts`
- Create: `chromacast/backend/src/services/lyrics.test.ts`
- Modify: `chromacast/backend/src/routes/spotify.ts` (agregar ruta `/lyrics`)

**Interfaces:**
- Consumes: `getSnapshot()` (Task 6).
- Produces (usado por Task 11):
  - `interface LyricLine { timeMs: number; text: string }`
  - `interface LyricsResult { synced: LyricLine[] | null; plain: string | null }`
  - `parseLrc(lrc: string): LyricLine[]`
  - `getLyrics(trackId: string, artist: string, track: string, durationSec: number): Promise<LyricsResult>`
  - `GET /api/lyrics` → `LyricsResult` (404 con `{ error }` si no hay track sonando).

- [ ] **Step 1: Test que falla — parser LRC**

`chromacast/backend/src/services/lyrics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseLrc } from "./lyrics";

describe("parseLrc", () => {
  it("parsea lineas [mm:ss.xx]", () => {
    const lrc = "[00:12.34] Hola mundo\n[01:02.50] Segunda linea";
    expect(parseLrc(lrc)).toEqual([
      { timeMs: 12340, text: "Hola mundo" },
      { timeMs: 62500, text: "Segunda linea" },
    ]);
  });

  it("ignora metadata y lineas invalidas", () => {
    const lrc = "[ar:Artista]\n[ti:Titulo]\nsin timestamp\n[00:05.00] Real";
    expect(parseLrc(lrc)).toEqual([{ timeMs: 5000, text: "Real" }]);
  });

  it("soporta segundos sin decimales y texto vacio", () => {
    expect(parseLrc("[02:00] \n[02:03.1] X")).toEqual([
      { timeMs: 120000, text: "" },
      { timeMs: 123100, text: "X" },
    ]);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/backend"
npx vitest run src/services/lyrics.test.ts
```

Expected: FAIL — `Cannot find module './lyrics'`.

- [ ] **Step 3: Implementar `lyrics.ts`**

```ts
import axios from "axios";

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface LyricsResult {
  synced: LyricLine[] | null;
  plain: string | null;
}

const cache = new Map<string, LyricsResult>();
const MAX_CACHE = 100;

export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split("\n")) {
    const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!m) continue;
    const timeMs = Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000);
    lines.push({ timeMs, text: m[3].trim() });
  }
  return lines;
}

export async function getLyrics(
  trackId: string,
  artist: string,
  track: string,
  durationSec: number
): Promise<LyricsResult> {
  const hit = cache.get(trackId);
  if (hit) return hit;

  let result: LyricsResult = { synced: null, plain: null };
  try {
    const res = await axios.get("https://lrclib.net/api/get", {
      params: { artist_name: artist, track_name: track, duration: durationSec },
      timeout: 8000,
      headers: { "User-Agent": "chromacast (https://github.com/)" },
    });
    result = {
      synced: res.data?.syncedLyrics ? parseLrc(res.data.syncedLyrics) : null,
      plain: res.data?.plainLyrics ?? null,
    };
    cacheSet(trackId, result);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      cacheSet(trackId, result); // "no existe" es cacheable; errores de red no
    }
  }
  return result;
}

function cacheSet(trackId: string, result: LyricsResult): void {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(trackId, result);
}
```

- [ ] **Step 4: Correr tests**

```bash
npx vitest run src/services/lyrics.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Agregar ruta en `routes/spotify.ts`**

Import arriba: `import { getLyrics } from "../services/lyrics";`

Ruta (antes de `export default router;`):

```ts
router.get("/lyrics", async (_req: Request, res: Response) => {
  const snap = getSnapshot();
  if (!snap.playing || !snap.id || !snap.artist || !snap.track) {
    res.status(404).json({ error: "No track playing" });
    return;
  }
  const result = await getLyrics(
    snap.id,
    snap.artist,
    snap.track,
    Math.round((snap.durationMs ?? 0) / 1000)
  );
  res.json(result);
});
```

- [ ] **Step 6: Typecheck + tests completos + commit**

```bash
npx tsc --noEmit
npm test
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/backend/src
git commit -m "feat(backend): letras via lrclib con cache y parser LRC"
```

Expected: PASS todo.

---

### Task 8: Frontend — fondo con cover blureada (crossfade)

**Files:**
- Modify: `chromacast/frontend/src/components/AmbientBackground.tsx` (reescritura)
- Modify: `chromacast/frontend/src/App.tsx` (pasar `coverUrl`)
- Modify: `chromacast/frontend/src/App.css` (estilos `.ambient-bg*`)

**Interfaces:**
- Consumes: `data.coverUrl`, `palette` de `useNowPlaying`.
- Produces: `AmbientBackground({ coverUrl, palette }: { coverUrl: string | null; palette: Palette | null })`.

- [ ] **Step 1: Reescribir `AmbientBackground.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { Palette } from "../types";

interface AmbientBackgroundProps {
  coverUrl: string | null;
  palette: Palette | null;
}

interface Layer {
  url: string;
  key: number;
}

function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function AmbientBackground({ coverUrl, palette }: AmbientBackgroundProps) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const keyRef = useRef(0);

  useEffect(() => {
    if (!coverUrl) return;
    setLayers(prev => {
      if (prev.length > 0 && prev[prev.length - 1].url === coverUrl) return prev;
      keyRef.current += 1;
      return [...prev.slice(-1), { url: coverUrl, key: keyRef.current }];
    });
  }, [coverUrl]);

  const vibrant = palette?.Vibrant ? rgbToCss(palette.Vibrant) : "rgb(29,185,84)";
  const dark = palette?.DarkVibrant ? rgbToCss(palette.DarkVibrant) : "rgb(10,10,10)";

  return (
    <div className="ambient-bg" aria-hidden="true">
      {layers.length === 0 && (
        <div
          className="ambient-bg-fallback"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 20% 30%, ${vibrant}22, transparent), radial-gradient(ellipse 70% 50% at 80% 70%, ${dark}44, transparent)`,
          }}
        />
      )}
      {layers.map((layer, i) => (
        <div
          key={layer.key}
          className={`ambient-bg-layer ${i === layers.length - 1 ? "ambient-bg-visible" : "ambient-bg-fading"}`}
          style={{ backgroundImage: `url(${layer.url})` }}
        />
      ))}
      <div className="ambient-bg-scrim" />
    </div>
  );
}
```

- [ ] **Step 2: Actualizar CSS**

En `chromacast/frontend/src/App.css` reemplazar el bloque `.ambient-bg { ... }` (líneas 47-55) por:

```css
.ambient-bg {
  position: fixed;
  inset: 0;
  z-index: var(--z-ambient);
  pointer-events: none;
  overflow: hidden;
}

.ambient-bg-fallback,
.ambient-bg-layer,
.ambient-bg-scrim {
  position: absolute;
  inset: 0;
}

.ambient-bg-layer {
  background-size: cover;
  background-position: center;
  filter: blur(60px) brightness(0.75);
  transform: scale(1.25);
  opacity: 0;
  transition: opacity 2.5s ease;
}

.ambient-bg-visible {
  opacity: 1;
}

.ambient-bg-fading {
  opacity: 0;
}

.ambient-bg-fallback {
  filter: blur(40px);
  transform: scale(1.2);
  opacity: 0.6;
}

.ambient-bg-scrim {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.6) 60%, rgba(0, 0, 0, 0.75) 100%);
}
```

- [ ] **Step 3: Actualizar los dos usos en `App.tsx`**

Los `<AmbientBackground palette={...} />` pasan a incluir la cover:
- Login screen: `<AmbientBackground coverUrl={null} palette={null} />`
- Vista principal: `<AmbientBackground coverUrl={data?.coverUrl ?? null} palette={palette} />`

- [ ] **Step 4: Typecheck + verificación manual**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/frontend"
npm run build
```

Expected: build OK. Luego con backend + `npm run dev` y Spotify sonando: el fondo es la cover blureada y oscurecida; al cambiar de canción hay crossfade ~2.5s; sin cover se ve el gradiente.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/frontend/src
git commit -m "feat(frontend): fondo con cover blureada y crossfade"
```

---

### Task 9: Frontend — tipos, barra superior y modal de configuración

**Files:**
- Modify: `chromacast/frontend/src/types/index.ts`
- Create: `chromacast/frontend/src/components/TopBar.tsx`
- Create: `chromacast/frontend/src/components/SettingsModal.tsx`
- Modify: `chromacast/frontend/src/App.tsx`
- Modify: `chromacast/frontend/src/App.css`

**Interfaces:**
- Consumes: `GET/PUT /api/settings` (Task 3).
- Produces (usado por Tasks 10-12):
  - Tipos: `NightModeSettings { enabled: boolean; start: string; end: string; maxBrightness: number }`, `AppSettings { spotifyClientId: string; spotifyClientSecret: string; spotifyRedirectUri: string; haUrl: string; haToken: string; primaryEntityIds: string[]; secondaryEntityIds: string[]; defaultColor: [number, number, number]; pauseTimeoutSec: number; pauseAction: "baseColor" | "off"; partySpeedSec: number; nightMode: NightModeSettings; lightsEnabled: boolean }`, `LyricLine { timeMs: number; text: string }`, `LyricsData { synced: LyricLine[] | null; plain: string | null }`.
  - `NowPlayingData` gana campos opcionales `lightsError?: string | null; night?: boolean; party?: boolean`.
  - `TopBar({ onOpenSettings, onEnterKiosk }: { onOpenSettings: () => void; onEnterKiosk: () => void })`
  - `SettingsModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (s: AppSettings) => void })`

- [ ] **Step 1: Agregar tipos**

Al final de `chromacast/frontend/src/types/index.ts`:

```ts
export interface NightModeSettings {
  enabled: boolean;
  start: string;
  end: string;
  maxBrightness: number;
}

export interface AppSettings {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  haUrl: string;
  haToken: string;
  primaryEntityIds: string[];
  secondaryEntityIds: string[];
  defaultColor: [number, number, number];
  pauseTimeoutSec: number;
  pauseAction: "baseColor" | "off";
  partySpeedSec: number;
  nightMode: NightModeSettings;
  lightsEnabled: boolean;
}

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface LyricsData {
  synced: LyricLine[] | null;
  plain: string | null;
}
```

Y en `NowPlayingData` agregar:

```ts
  lightsError?: string | null;
  night?: boolean;
  party?: boolean;
```

- [ ] **Step 2: Crear `TopBar.tsx`**

```tsx
interface TopBarProps {
  onOpenSettings: () => void;
  onEnterKiosk: () => void;
}

export default function TopBar({ onOpenSettings, onEnterKiosk }: TopBarProps) {
  return (
    <div className="top-bar">
      <button className="top-bar-btn" onClick={onEnterKiosk} title="Pantalla completa" aria-label="Modo pantalla completa">
        ⛶
      </button>
      <button className="top-bar-btn" onClick={onOpenSettings} title="Configuración" aria-label="Configuración">
        ⚙️
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Crear `SettingsModal.tsx`**

```tsx
import { useEffect, useState } from "react";
import axios from "axios";
import type { AppSettings } from "../types";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (s: AppSettings) => void;
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export default function SettingsModal({ open, onClose, onSaved }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    axios.get<AppSettings>("/api/settings")
      .then(res => setSettings(res.data))
      .catch(() => setError("No se pudo cargar la configuración"));
  }, [open]);

  if (!open) return null;

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const res = await axios.put<AppSettings>("/api/settings", settings);
      onSaved(res.data);
      onClose();
    } catch {
      setError("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configuración</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {!settings && !error && <p className="modal-loading">Cargando…</p>}
        {error && <p className="config-error">{error}</p>}

        {settings && (
          <div className="modal-body">
            <fieldset>
              <legend>Spotify</legend>
              <label>
                Client ID
                <input value={settings.spotifyClientId} onChange={e => set("spotifyClientId", e.target.value)} />
              </label>
              <label>
                Client Secret
                <input type="password" value={settings.spotifyClientSecret} onChange={e => set("spotifyClientSecret", e.target.value)} />
              </label>
              <label>
                Redirect URI
                <input value={settings.spotifyRedirectUri} onChange={e => set("spotifyRedirectUri", e.target.value)} />
              </label>
            </fieldset>

            <fieldset>
              <legend>Home Assistant</legend>
              <label>
                URL
                <input value={settings.haUrl} onChange={e => set("haUrl", e.target.value)} placeholder="http://homeassistant.local:8123" />
              </label>
              <label>
                Token
                <input type="password" value={settings.haToken} onChange={e => set("haToken", e.target.value)} />
              </label>
              <label>
                Entidades primarias
                <input
                  value={settings.primaryEntityIds.join(", ")}
                  onChange={e => set("primaryEntityIds", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder="light.sala"
                />
              </label>
              <label>
                Entidades secundarias
                <input
                  value={settings.secondaryEntityIds.join(", ")}
                  onChange={e => set("secondaryEntityIds", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder="light.cocina, light.jardin"
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Al pausar</legend>
              <label>
                Acción
                <select
                  value={settings.pauseAction}
                  onChange={e => set("pauseAction", e.target.value as AppSettings["pauseAction"])}
                >
                  <option value="baseColor">Volver al color base</option>
                  <option value="off">Apagar las luces</option>
                </select>
              </label>
              <label>
                Segundos antes de actuar
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={settings.pauseTimeoutSec}
                  onChange={e => set("pauseTimeoutSec", Number(e.target.value))}
                />
              </label>
              <label>
                Color base
                <input
                  type="color"
                  value={rgbToHex(settings.defaultColor)}
                  onChange={e => set("defaultColor", hexToRgb(e.target.value))}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Modo nocturno</legend>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.nightMode.enabled}
                  onChange={e => set("nightMode", { ...settings.nightMode, enabled: e.target.checked })}
                />
                Activado
              </label>
              <label>
                Desde
                <input
                  type="time"
                  value={settings.nightMode.start}
                  onChange={e => set("nightMode", { ...settings.nightMode, start: e.target.value })}
                />
              </label>
              <label>
                Hasta
                <input
                  type="time"
                  value={settings.nightMode.end}
                  onChange={e => set("nightMode", { ...settings.nightMode, end: e.target.value })}
                />
              </label>
              <label>
                Brillo máximo ({Math.round((settings.nightMode.maxBrightness / 255) * 100)}%)
                <input
                  type="range"
                  min={1}
                  max={255}
                  value={settings.nightMode.maxBrightness}
                  onChange={e => set("nightMode", { ...settings.nightMode, maxBrightness: Number(e.target.value) })}
                />
              </label>
            </fieldset>

            <button className="login-button" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: CSS del modal y top bar**

Al final de `chromacast/frontend/src/App.css`:

```css
/* Top bar */
.top-bar {
  position: fixed;
  top: 1.25rem;
  right: 1.5rem;
  z-index: 50;
  display: flex;
  gap: 0.5rem;
}

.top-bar-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #fff;
  font-size: 1rem;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.top-bar-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}

/* Settings modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.modal-content {
  background: rgba(20, 20, 24, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: min(560px, 100%);
  max-height: 85vh;
  overflow-y: auto;
  padding: 1.5rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modal-header h2 {
  font-size: 1.15rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1rem;
  cursor: pointer;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-body fieldset {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.modal-body legend {
  padding: 0 0.4rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.55);
}

.modal-body label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
}

.modal-body label.checkbox-label {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.modal-body input,
.modal-body select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  padding: 0.5rem 0.65rem;
  font-size: 0.9rem;
}

.modal-loading {
  color: rgba(255, 255, 255, 0.6);
}
```

- [ ] **Step 5: Integrar en `App.tsx`**

Agregar imports:

```tsx
import TopBar from "./components/TopBar";
import SettingsModal from "./components/SettingsModal";
import type { AppSettings } from "./types";
```

Agregar estado dentro de `App()` (SIN estado de kiosk todavía — se agrega en Task 12; declararlo acá sin leerlo rompería el build por `noUnusedLocals`):

```tsx
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (configured && authenticated) {
      axios.get<AppSettings>("/api/settings").then(res => setSettings(res.data)).catch(() => {});
    }
  }, [configured, authenticated]);
```

En el JSX de la vista principal autenticada (el `return` final), como hermanos de `<Toast .../>` (la TopBar es `position: fixed`, queda visible incluso sin música sonando):

```tsx
      <TopBar onOpenSettings={() => setSettingsOpen(true)} onEnterKiosk={() => {}} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={setSettings} />
```

(el `onEnterKiosk={() => {}}` es transitorio: Task 12 Step 3 lo reemplaza por `() => setKiosk(true)` cuando el estado exista.)

- [ ] **Step 6: Typecheck + verificación manual + commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/frontend"
npm run build
```

Expected: OK. Manual: botón ⚙️ abre el modal con los valores actuales; guardar persiste (verificar `backend/data/config.json`); cerrar con ✕ o clic afuera.

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/frontend/src
git commit -m "feat(frontend): top bar y modal de configuracion completo"
```

---

### Task 10: Frontend — LightPanel integrado (fiesta, paleta, mock, nocturno) y lightsEnabled desde backend

**Files:**
- Modify: `chromacast/frontend/src/components/LightPanel.tsx` (reescritura)
- Modify: `chromacast/frontend/src/App.tsx`
- Delete: `chromacast/frontend/src/components/ColorPalette.tsx` (se integra)

**Interfaces:**
- Consumes: `PUT /api/settings` (lightsEnabled, partySpeedSec), `POST /api/lights/party`, `POST /api/lights/update|brightness|transition|preset`, campos `lightsError`/`night`/`party` de now-playing, `MockLight` existente.
- Produces: `LightPanel({ palette, data, settings, onSettingsChange }: { palette: Palette | null; data: NowPlayingData | null; settings: AppSettings | null; onSettingsChange: (s: AppSettings) => void })`.

- [ ] **Step 1: Reescribir `LightPanel.tsx`**

```tsx
import { useState, useCallback } from "react";
import axios from "axios";
import type { Palette, NowPlayingData, AppSettings } from "../types";
import MockLight from "./MockLight";

interface LightPanelProps {
  palette: Palette | null;
  data: NowPlayingData | null;
  settings: AppSettings | null;
  onSettingsChange: (s: AppSettings) => void;
}

function rgbToCss(rgb: [number, number, number] | null): string {
  if (!rgb) return "transparent";
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

const COLOR_SOURCES: { key: keyof Palette; label: string }[] = [
  { key: "Vibrant", label: "Vibrant" },
  { key: "DarkVibrant", label: "Dark Vibrant" },
  { key: "Muted", label: "Muted" },
  { key: "DarkMuted", label: "Dark Muted" },
  { key: "LightVibrant", label: "Light Vibrant" },
];

const PRESETS = [
  { name: "relax", label: "Relax" },
  { name: "party", label: "Party" },
  { name: "cinema", label: "Cinema" },
  { name: "focus", label: "Focus" },
];

export default function LightPanel({ palette, data, settings, onSettingsChange }: LightPanelProps) {
  const [brightness, setBrightness] = useState(255);
  const [transition, setTransition] = useState(1.5);
  const [primarySource, setPrimarySource] = useState<keyof Palette>("Vibrant");
  const [secondarySource, setSecondarySource] = useState<keyof Palette>("DarkVibrant");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const enabled = settings?.lightsEnabled ?? false;
  const party = data?.party ?? false;
  const night = data?.night ?? false;

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  const putSettings = useCallback(async (patch: Partial<AppSettings>) => {
    try {
      const res = await axios.put<AppSettings>("/api/settings", patch);
      onSettingsChange(res.data);
    } catch {
      flash("No se pudo guardar");
    }
  }, [onSettingsChange]);

  const toggleLights = () => putSettings({ lightsEnabled: !enabled });

  const toggleParty = async () => {
    try {
      await axios.post("/api/lights/party", { on: !party });
    } catch {
      flash("Error de conexión");
    }
  };

  const sendUpdate = async () => {
    const primary = palette?.[primarySource] ?? [255, 255, 255];
    const secondary = palette?.[secondarySource] ?? [255, 255, 255];
    try {
      const res = await axios.post("/api/lights/update", {
        brightness,
        transition,
        primaryColor: primary,
        secondaryColor: secondary,
      });
      flash(res.data.success ? "Luces actualizadas" : res.data.error || "Falló");
    } catch {
      flash("Error de conexión");
    }
  };

  const applyPreset = async (name: string) => {
    setActivePreset(name);
    try {
      const res = await axios.post("/api/lights/preset", { name });
      if (res.data.success) {
        setBrightness(res.data.brightness);
        setTransition(res.data.transition);
        flash(`${name} aplicado`);
      } else {
        flash(res.data.error || "Falló");
      }
    } catch {
      flash("Error de conexión");
    }
  };

  const handleBrightness = (val: number) => {
    setBrightness(val);
    axios.post("/api/lights/brightness", { brightness: val }).catch(() => {});
  };

  const handleTransition = (val: number) => {
    setTransition(val);
    axios.post("/api/lights/transition", { transition: val }).catch(() => {});
  };

  return (
    <div className="light-panel">
      <div className="light-panel-header">
        <span className="light-panel-title">
          Luces {night && <span title="Modo nocturno activo">🌙</span>}
        </span>
        <button
          className={`toggle-button ${enabled ? "toggle-on" : ""}`}
          onClick={toggleLights}
          aria-label="Encender o apagar sincronización de luces"
        >
          <span className={`toggle-knob ${enabled ? "toggle-right" : "toggle-left"}`} />
        </button>
      </div>

      {data?.lightsError && <p className="light-error">HA no responde: {data.lightsError}</p>}

      {enabled && (
        <>
          <div className="light-presets">
            {PRESETS.map(p => (
              <button
                key={p.name}
                className={`preset-btn ${activePreset === p.name ? "preset-active" : ""}`}
                onClick={() => applyPreset(p.name)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="light-panel-header">
            <span className="light-panel-title">Modo fiesta 🎉</span>
            <button
              className={`toggle-button ${party ? "toggle-on" : ""}`}
              onClick={toggleParty}
              aria-label="Modo fiesta"
            >
              <span className={`toggle-knob ${party ? "toggle-right" : "toggle-left"}`} />
            </button>
          </div>

          {settings && (
            <div className="light-control-row">
              <label className="light-control-label">
                Velocidad fiesta
                <span className="light-control-value">{settings.partySpeedSec}s</span>
              </label>
              <input
                type="range"
                min="2"
                max="60"
                value={settings.partySpeedSec}
                onChange={e => putSettings({ partySpeedSec: Number(e.target.value) })}
                className="light-slider"
              />
            </div>
          )}

          <div className="light-control-row">
            <label className="light-control-label">
              Brillo
              <span className="light-control-value">{Math.round((brightness / 255) * 100)}%</span>
            </label>
            <input
              type="range"
              min="1"
              max="255"
              value={brightness}
              onChange={e => handleBrightness(Number(e.target.value))}
              className="light-slider"
            />
          </div>

          <div className="light-control-row">
            <label className="light-control-label">
              Transición
              <span className="light-control-value">{transition.toFixed(1)}s</span>
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={transition}
              onChange={e => handleTransition(Number(e.target.value))}
              className="light-slider"
            />
          </div>

          <div className="color-picker-section">
            {([
              ["Primario", primarySource, setPrimarySource],
              ["Secundario", secondarySource, setSecondarySource],
            ] as const).map(([label, source, setSource]) => (
              <div className="color-picker-group" key={label}>
                <span className="color-picker-label">{label}</span>
                <div className="color-picker-swatches">
                  {COLOR_SOURCES.map(src => {
                    const color = palette?.[src.key];
                    return (
                      <button
                        key={src.key}
                        className={`color-swatch-btn ${source === src.key ? "color-swatch-active" : ""}`}
                        style={{ backgroundColor: color ? rgbToCss(color) : "#333" }}
                        onClick={() => setSource(src.key)}
                        title={src.label}
                        aria-label={`${label}: ${src.label}`}
                        disabled={!color}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button className="send-button" onClick={sendUpdate}>
            Aplicar a las luces
          </button>
        </>
      )}

      {!enabled && <MockLight palette={palette} />}

      {status && <p className="light-status">{status}</p>}
    </div>
  );
}
```

- [ ] **Step 2: CSS del error**

Al final de `App.css`:

```css
.light-error {
  color: #ff7b72;
  font-size: 0.8rem;
}
```

- [ ] **Step 3: Actualizar `App.tsx`**

- Eliminar el estado `enableLights` y el `useEffect` que postea `/api/lights/update` al cambiar de track (el backend lo hace ahora; es el bloque `useEffect(() => { if (trackId && trackId !== lastTrackRef.current) ... }, [trackId, enableLights])` junto con `lastTrackRef`).
- Eliminar los imports de `ColorPalette` y `MockLight` (MockLight ahora lo importa LightPanel) y sus usos `<ColorPalette palette={palette} />` y `{!enableLights && <MockLight palette={palette} />}`.
- Reemplazar el uso de LightPanel por:

```tsx
            <LightPanel
              palette={palette}
              data={data}
              settings={settings}
              onSettingsChange={setSettings}
            />
```

- [ ] **Step 4: Borrar `ColorPalette.tsx` tras verificar que no queda uso**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/frontend"
grep -rn "ColorPalette" src/ ; echo "exit: $?"
```

Expected tras las ediciones: sin matches (exit 1). Luego `rm src/components/ColorPalette.tsx`.

- [ ] **Step 5: Typecheck + verificación manual + commit**

```bash
npm run build
```

Expected: OK. Manual: el toggle de luces persiste tras recargar (viene de settings); el toggle fiesta cambia y se refleja (el estado `party` llega por polling); con HA sin configurar y luces ON, aparece "HA no responde: ..." tras un update.

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add -A chromacast/frontend/src
git commit -m "feat(frontend): light panel integrado con fiesta, nocturno y estado del backend"
```

---

### Task 11: Frontend — sección segmentada Cola | Letra | Historial

**Files:**
- Create: `chromacast/frontend/src/components/MediaTabs.tsx`
- Create: `chromacast/frontend/src/components/LyricsView.tsx`
- Modify: `chromacast/frontend/src/App.tsx`
- Modify: `chromacast/frontend/src/App.css`
- Delete: `chromacast/frontend/src/components/QueuePanel.tsx`, `chromacast/frontend/src/components/TrackHistory.tsx` (contenido absorbido)

**Interfaces:**
- Consumes: `GET /api/player/queue`, `GET /api/history`, `GET /api/lyrics` (Task 7), tipos `QueueData`, `TrackHistoryEntry`, `LyricsData`.
- Produces: `MediaTabs({ trackId, progressMs }: { trackId: string | null; progressMs: number })`, `LyricsView({ trackId, progressMs }: { trackId: string | null; progressMs: number })`.

- [ ] **Step 1: Crear `LyricsView.tsx`**

```tsx
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import type { LyricsData } from "../types";

interface LyricsViewProps {
  trackId: string | null;
  progressMs: number;
}

export default function LyricsView({ trackId, progressMs }: LyricsViewProps) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  const active = lyrics?.synced ? currentLineIndex(lyrics.synced, progressMs) : -1;

  useEffect(() => {
    if (!trackId) {
      setLyrics(null);
      return;
    }
    setLoading(true);
    setLyrics(null);
    axios.get<LyricsData>("/api/lyrics")
      .then(res => setLyrics(res.data))
      .catch(() => setLyrics({ synced: null, plain: null }))
      .finally(() => setLoading(false));
  }, [trackId]);

  useEffect(() => {
    if (active >= 0) {
      activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [active]);

  if (loading) return <p className="lyrics-empty">Buscando letra…</p>;
  if (!lyrics || (!lyrics.synced && !lyrics.plain)) {
    return <p className="lyrics-empty">Letra no disponible</p>;
  }

  if (lyrics.synced) {
    return (
      <div className="lyrics-list">
        {lyrics.synced.map((line, i) => (
          <p
            key={`${line.timeMs}-${i}`}
            ref={i === active ? activeRef : null}
            className={`lyrics-line ${i === active ? "lyrics-active" : ""}`}
          >
            {line.text || "♪"}
          </p>
        ))}
      </div>
    );
  }

  return <pre className="lyrics-plain">{lyrics.plain}</pre>;
}

function currentLineIndex(lines: { timeMs: number }[], progressMs: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= progressMs) idx = i;
    else break;
  }
  return idx;
}
```

- [ ] **Step 2: Crear `MediaTabs.tsx`**

```tsx
import { useState, useEffect } from "react";
import axios from "axios";
import type { QueueData, TrackHistoryEntry } from "../types";
import LyricsView from "./LyricsView";

type Tab = "queue" | "lyrics" | "history";

interface MediaTabsProps {
  trackId: string | null;
  progressMs: number;
}

export default function MediaTabs({ trackId, progressMs }: MediaTabsProps) {
  const [tab, setTab] = useState<Tab>("queue");
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [history, setHistory] = useState<TrackHistoryEntry[]>([]);

  useEffect(() => {
    if (tab === "queue") {
      axios.get<QueueData>("/api/player/queue").then(res => setQueue(res.data)).catch(() => {});
    } else if (tab === "history") {
      axios.get<{ history: TrackHistoryEntry[] }>("/api/history")
        .then(res => setHistory(res.data.history))
        .catch(() => {});
    }
  }, [tab, trackId]);

  return (
    <div className="media-tabs">
      <div className="media-tabs-bar" role="tablist">
        {([
          ["queue", "Cola"],
          ["lyrics", "Letra"],
          ["history", "Historial"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`media-tab ${tab === key ? "media-tab-active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="media-tabs-content">
        {tab === "queue" && (
          <div className="queue-list">
            {(!queue || queue.queue.length === 0) && <p className="queue-empty">No hay próximas canciones</p>}
            {queue?.queue.map((item, i) => (
              <div key={`${item.id}-${i}`} className="queue-item">
                {item.coverUrl && <img src={item.coverUrl} alt="" className="queue-item-cover" draggable={false} />}
                <div className="queue-item-info">
                  <span className="queue-item-track">{item.track}</span>
                  <span className="queue-item-artist">{item.artist}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "lyrics" && <LyricsView trackId={trackId} progressMs={progressMs} />}

        {tab === "history" && (
          <div className="queue-list">
            {history.length === 0 && <p className="queue-empty">Sin historial todavía</p>}
            {history.map(item => (
              <div key={`${item.id}-${item.playedAt}`} className="queue-item">
                {item.coverUrl && <img src={item.coverUrl} alt="" className="queue-item-cover" draggable={false} />}
                <div className="queue-item-info">
                  <span className="queue-item-track">{item.track}</span>
                  <span className="queue-item-artist">{item.artist}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: CSS**

Al final de `App.css`:

```css
/* Media tabs */
.media-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.media-tabs-bar {
  display: flex;
  gap: 0.4rem;
}

.media-tab {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  padding: 0.35rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.media-tab-active {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.media-tabs-content {
  max-height: 260px;
  overflow-y: auto;
}

/* Lyrics */
.lyrics-empty {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
}

.lyrics-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lyrics-line {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.95rem;
  transition: color 0.3s ease, transform 0.3s ease;
}

.lyrics-active {
  color: #fff;
  font-weight: 600;
  transform: scale(1.02);
}

.lyrics-plain {
  white-space: pre-wrap;
  font-family: inherit;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9rem;
}
```

- [ ] **Step 4: Integrar en `App.tsx` y borrar paneles viejos**

En `App.tsx`: quitar imports y usos de `QueuePanel` y `TrackHistory`; en su lugar (mismo sitio del layout):

```tsx
            <MediaTabs trackId={trackId} progressMs={data.progressMs ?? 0} />
```

con `import MediaTabs from "./components/MediaTabs";`. Luego:

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/frontend"
grep -rn "QueuePanel\|TrackHistory" src/ ; echo "exit: $?"
```

Expected: sin matches. Después `rm src/components/QueuePanel.tsx src/components/TrackHistory.tsx`.

- [ ] **Step 5: Typecheck + verificación manual + commit**

```bash
npm run build
```

Expected: OK. Manual: las tres pestañas cambian contenido; con una canción con letra en lrclib la línea activa se resalta y auto-scrollea; con una sin letra aparece "Letra no disponible".

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add -A chromacast/frontend/src
git commit -m "feat(frontend): pestañas cola/letra/historial con letras sincronizadas"
```

---

### Task 12: Frontend — modo kiosk

**Files:**
- Create: `chromacast/frontend/src/components/KioskView.tsx`
- Modify: `chromacast/frontend/src/App.tsx`
- Modify: `chromacast/frontend/src/App.css`

**Interfaces:**
- Consumes: estado `kiosk`/`setKiosk` (Task 9), `data`, `palette`.
- Produces: `KioskView({ data, palette, onExit }: { data: NowPlayingData; palette: Palette | null; onExit: () => void })`.

- [ ] **Step 1: Crear `KioskView.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { NowPlayingData, Palette } from "../types";
import AmbientBackground from "./AmbientBackground";

interface KioskViewProps {
  data: NowPlayingData;
  palette: Palette | null;
  onExit: () => void;
}

export default function KioskView({ data, palette, onExit }: KioskViewProps) {
  const [cursorHidden, setCursorHidden] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handleMove = () => {
      setCursorHidden(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setCursorHidden(true), 3000);
    };
    handleMove();
    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return (
    <div className={`kiosk ${cursorHidden ? "kiosk-no-cursor" : ""}`} onClick={onExit}>
      <AmbientBackground coverUrl={data.coverUrl ?? null} palette={palette} />
      <div className="kiosk-content">
        {data.coverUrl && (
          <img src={data.coverUrl} alt="" className="kiosk-cover" draggable={false} />
        )}
        <h1 className="kiosk-track">{data.track}</h1>
        <p className="kiosk-artist">{data.artist}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: CSS**

Al final de `App.css`:

```css
/* Kiosk */
.kiosk {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kiosk-no-cursor {
  cursor: none;
}

.kiosk-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  text-align: center;
  padding: 2rem;
}

.kiosk-cover {
  width: min(55vh, 70vw);
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 20px;
  box-shadow: 0 0 120px 20px rgba(0, 0, 0, 0.6);
}

.kiosk-track {
  font-size: clamp(1.4rem, 3.5vw, 2.4rem);
  font-weight: 700;
}

.kiosk-artist {
  font-size: clamp(1rem, 2.2vw, 1.4rem);
  color: rgba(255, 255, 255, 0.7);
}
```

- [ ] **Step 3: Integrar en `App.tsx`**

Import: `import KioskView from "./components/KioskView";`

Agregar el estado (junto a `settingsOpen`/`settings` de Task 9):

```tsx
  const [kiosk, setKiosk] = useState(false);
```

Reemplazar el `onEnterKiosk={() => {}}` transitorio de Task 9 por:

```tsx
      <TopBar onOpenSettings={() => setSettingsOpen(true)} onEnterKiosk={() => setKiosk(true)} />
```

Antes del `return` principal (después de los early returns de config/login), agregar:

```tsx
  if (kiosk && data?.playing) {
    return <KioskView data={data} palette={palette} onExit={() => setKiosk(false)} />;
  }
```

Nota: el polling sigue activo en kiosk porque `useNowPlaying` depende de `pageVisible`, no del modo.

- [ ] **Step 4: Typecheck + verificación manual + commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/frontend"
npm run build
```

Expected: OK. Manual: ⛶ entra a pantalla completa con cover + track; el cursor desaparece a los 3s de quietud; un clic sale y restaura la vista normal.

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/frontend/src
git commit -m "feat(frontend): modo kiosk pantalla completa"
```

---

### Task 13: Empaquetado open source (Docker, README, LICENSE)

**Files:**
- Create: `chromacast/Dockerfile`
- Create: `chromacast/docker-compose.yml`
- Create: `chromacast/.dockerignore`
- Create: `chromacast/.env.example`
- Create: `LICENSE` (raíz)
- Create: `README.md` (raíz)

**Interfaces:**
- Consumes: `DATA_DIR` (Task 2), servido de estáticos en `index.ts` (existente), `NODE_ENV=production`.
- Produces: imagen Docker single-container que sirve API + frontend en `:3001` con volumen `/data`.

- [ ] **Step 1: `chromacast/Dockerfile`**

```dockerfile
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend .
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
COPY --from=backend /app/backend/dist ./backend/dist
COPY --from=backend /app/backend/node_modules ./backend/node_modules
COPY --from=backend /app/backend/package.json ./backend/package.json
COPY --from=frontend /app/frontend/dist ./frontend/dist
EXPOSE 3001
VOLUME ["/data"]
CMD ["node", "backend/dist/index.js"]
```

Nota: `backend/dist/index.js` resuelve estáticos con `path.resolve(__dirname, "../../frontend/dist")` → `/app/frontend/dist` ✓ (ya soportado por `index.ts`).

- [ ] **Step 2: `chromacast/.dockerignore`**

```
**/node_modules
**/dist
backend/data
.env
```

- [ ] **Step 3: `chromacast/docker-compose.yml`**

```yaml
services:
  chromacast:
    build: .
    ports:
      - "3001:3001"
    env_file:
      - .env
    volumes:
      - ./data:/data
    restart: unless-stopped
```

- [ ] **Step 4: `chromacast/.env.example`**

```bash
# Todas las variables son OPCIONALES: podes configurar todo desde la UI.
# Si las definis, tienen prioridad sobre lo guardado en la UI.

# Spotify (https://developer.spotify.com/dashboard)
#SPOTIFY_CLIENT_ID=
#SPOTIFY_CLIENT_SECRET=
#SPOTIFY_REDIRECT_URI=http://localhost:3001/auth/callback

# Home Assistant
#HA_URL=http://homeassistant.local:8123
#HA_TOKEN=
#HA_ENTITY_IDS_PRIMARY=light.sala
#HA_ENTITY_IDS_SECONDARY=light.cocina,light.jardin

# Server
#PORT=3001
#FRONTEND_URL=http://localhost:3001
```

- [ ] **Step 5: `LICENSE` (raíz) — MIT**

```
MIT License

Copyright (c) 2026 chromacast contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 6: `README.md` (raíz)**

```markdown
# chromacast

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
cd chromacast
cp .env.example .env   # opcional: completar credenciales
docker compose up -d
```

Abrí http://localhost:3001, completá la configuración inicial (si no usaste
`.env`) y conectá tu cuenta de Spotify.

## Desarrollo local

```bash
# Backend (puerto 3001)
cd chromacast/backend
npm install
npm run dev

# Frontend (puerto 5173, proxy al backend)
cd chromacast/frontend
npm install
npm run dev
```

Tests del backend: `cd chromacast/backend && npm test`

## Configuración

Todo se configura desde la UI (botón ⚙️) y se guarda en `backend/data/config.json`
(o el volumen `/data` en Docker). Las variables de entorno (ver `.env.example`)
tienen prioridad sobre lo guardado.

## Roadmap

- Versión hostada multi-usuario (cuentas + HA expuesto vía Nabu Casa/URL pública)

## Licencia

MIT — ver [LICENSE](LICENSE).
```

- [ ] **Step 7: Verificar build Docker**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast"
docker build -t chromacast:dev .
docker run --rm -d -p 3001:3001 -v "$PWD/data:/data" --name chromacast-test chromacast:dev
sleep 5
curl -s http://localhost:3001/api/config
docker rm -f chromacast-test
```

Expected: `{"configured":false}` (o `true` si hay .env), y la raíz `http://localhost:3001/` sirve el frontend. Si Docker Desktop no está corriendo, dejarlo anotado y verificar al final.

- [ ] **Step 8: Commit**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add chromacast/Dockerfile chromacast/docker-compose.yml chromacast/.dockerignore chromacast/.env.example LICENSE README.md
git commit -m "docs+chore: empaquetado docker, readme, licencia MIT"
```

---

### Task 14: Limpieza final + verificación end-to-end

**Files:**
- Delete (si no tienen usos): `chromacast/frontend/src/components/NowPlaying.tsx`, `chromacast/frontend/src/components/LightControls.tsx`
- Modify: `docs/superpowers/specs/2026-07-05-chromacast-v2-design.md` (sin cambios salvo hallazgos)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: árbol limpio, suite verde, verificación manual completa.

- [ ] **Step 1: Borrar componentes muertos**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/frontend"
grep -rn "components/NowPlaying\|components/LightControls" src/ ; echo "exit: $?"
```

Expected: sin matches (exit 1) — nadie importa esos componentes. Entonces borrarlos:

```bash
rm src/components/NowPlaying.tsx src/components/LightControls.tsx
```

- [ ] **Step 2: Suite completa + builds**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix/chromacast/backend"
npm test
npx tsc --noEmit
cd ../frontend
npm run build
```

Expected: todo verde.

- [ ] **Step 3: Verificación manual end-to-end (usar la skill superpowers:verification-before-completion)**

Checklist con backend + frontend en dev y Spotify sonando:

1. Login Spotify OK; reiniciar el backend → la sesión se restaura sola (refresh token persistido).
2. Fondo = cover blureada; crossfade al cambiar canción.
3. Play/pausa/next/prev/volumen/seek funcionan.
4. Luces ON (con HA real o observando logs): cambio de canción → colores nuevos.
5. Pausar y cerrar la pestaña → a los N segundos las luces van al color base (verificar con la config `pauseAction: off` también).
6. Modo fiesta ON → rotación de colores cada `partySpeedSec`; pausa la detiene; reanudar la retoma.
7. Modo nocturno con rango que incluye la hora actual → los updates llegan clampados (log o luz física).
8. Modal ⚙️ → cambiar timeout de pausa y color base → se persiste en `backend/data/config.json` y sobrevive reinicio.
9. Pestañas Cola/Letra/Historial; letra sincronizada resalta la línea actual.
10. Kiosk: entra fullscreen, cursor se oculta, clic sale.
11. `docker compose up` sirve todo en :3001 (si no se pudo en Task 13).

- [ ] **Step 4: Commit final**

```bash
cd "c:/Users/tomas/Documents/GitHub/Sync&mix"
git add -A
git commit -m "chore: limpieza de componentes muertos y verificacion final v2"
```
