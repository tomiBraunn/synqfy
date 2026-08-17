export interface Palette {
  Vibrant: [number, number, number] | null;
  DarkVibrant: [number, number, number] | null;
  Muted: [number, number, number] | null;
  DarkMuted: [number, number, number] | null;
  LightVibrant: [number, number, number] | null;
  LightMuted: [number, number, number] | null;
}

export interface LightColors {
  primary: [number, number, number];
  secondary: [number, number, number];
}

export interface NowPlayingData {
  playing: boolean;
  isPlaying?: boolean;
  id?: string;
  track?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  progressMs?: number;
  progressAgeMs?: number;
  receivedAt?: number;
  durationMs?: number;
  volume?: number;
  palette?: Palette | null;
  /** El color que Spotify pone alrededor de la tapa. */
  spotifyColor?: [number, number, number] | null;
  lightColors?: LightColors | null;
  brightness?: number;
  transition?: number;
  lightsError?: string | null;
  night?: boolean;
}

export interface HaLight {
  entityId: string;
  name: string;
  on: boolean;
}

export interface ConfigData {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  haUrl: string;
  haToken: string;
  primaryEntityIds: string;
  secondaryEntityIds: string;
}

export interface QueueItem {
  id: string;
  track: string;
  artist: string;
  coverUrl: string;
  durationMs: number;
}

export interface QueueData {
  currentlyPlaying: QueueItem | null;
  queue: QueueItem[];
}

export interface TrackHistoryEntry {
  id: string;
  track: string;
  artist: string;
  album: string;
  coverUrl: string;
  playedAt: number;
  palette: Palette | null;
}

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
  defaultKelvin: number | null;
  pauseBrightness: number;
  pauseTimeoutSec: number;
  pauseAction: "baseColor" | "off";
  nightMode: NightModeSettings;
  lightsEnabled: boolean;
  /** El backend nunca manda los secretos: solo si ya hay uno guardado. */
  secretsSet?: { haToken: boolean; spotifyClientSecret: boolean };
}

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface LyricsData {
  synced: LyricLine[] | null;
  plain: string | null;
}
