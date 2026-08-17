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
  defaultKelvin: number | null; // si está seteado, al pausar se usa temperatura en vez de RGB
  pauseBrightness: number; // 1-255, brillo al volver al color base
  pauseTimeoutSec: number;
  pauseAction: "baseColor" | "off";
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
  defaultKelvin: null,
  pauseBrightness: 120,
  pauseTimeoutSec: 5,
  pauseAction: "baseColor",
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
  let parsed: Partial<AppSettings> = {};
  try {
    parsed = JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch {
    parsed = {};
  }

  settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...parsed,
    nightMode: { ...DEFAULT_SETTINGS.nightMode, ...(parsed.nightMode ?? {}) },
  };

  // Qué lámparas participan se elige desde la página, así que las env vars solo
  // siembran el primer arranque (docker-compose). Si mandaran en cada lectura,
  // poner una lámpara en "No" se desharía sola al releer los ajustes.
  if (parsed.primaryEntityIds === undefined) {
    settings.primaryEntityIds = parseIds(process.env.HA_ENTITY_IDS_PRIMARY);
  }
  if (parsed.secondaryEntityIds === undefined) {
    settings.secondaryEntityIds = parseIds(process.env.HA_ENTITY_IDS_SECONDARY);
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
