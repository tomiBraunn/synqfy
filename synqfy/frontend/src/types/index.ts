export interface Palette {
  Vibrant: [number, number, number] | null;
  DarkVibrant: [number, number, number] | null;
  Muted: [number, number, number] | null;
  DarkMuted: [number, number, number] | null;
  LightVibrant: [number, number, number] | null;
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
  lightsError?: string | null;
  night?: boolean;
  party?: boolean;
}

export interface LightUpdateResult {
  success: boolean;
  primary?: [number, number, number];
  secondary?: [number, number, number];
  brightness?: number;
  transition?: number;
  error?: string;
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

export interface Preset {
  name: string;
  label: string;
  primarySource: string;
  secondarySource: string;
  brightness: number;
  transition: number;
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
