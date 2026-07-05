export interface TrackHistoryEntry {
  id: string;
  track: string;
  artist: string;
  album: string;
  coverUrl: string;
  playedAt: number;
  palette: {
    Vibrant: [number, number, number] | null;
    DarkVibrant: [number, number, number] | null;
    Muted: [number, number, number] | null;
    DarkMuted: [number, number, number] | null;
    LightVibrant: [number, number, number] | null;
  } | null;
}

export interface LightPreset {
  name: string;
  label: string;
  primarySource: keyof TrackHistoryEntry["palette"] extends never ? string : string;
  secondarySource: string;
  brightness: number;
  transition: number;
}

const history: TrackHistoryEntry[] = [];
const MAX_HISTORY = 20;

let defaultColor: [number, number, number] = [255, 200, 150];
let pausedTimeoutActive = false;

export function getDefaultColor(): [number, number, number] {
  return defaultColor;
}

export function setDefaultColor(color: [number, number, number]): void {
  defaultColor = color;
}

export function isPausedTimeoutActive(): boolean {
  return pausedTimeoutActive;
}

export function setPausedTimeoutActive(active: boolean): void {
  pausedTimeoutActive = active;
}

export function addToHistory(entry: TrackHistoryEntry): void {
  const exists = history.findIndex(h => h.id === entry.id);
  if (exists !== -1) {
    history.splice(exists, 1);
  }
  history.unshift(entry);
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
}

export function getHistory(): TrackHistoryEntry[] {
  return history;
}

export const PRESETS: LightPreset[] = [
  {
    name: "relax",
    label: "Relax",
    primarySource: "Muted",
    secondarySource: "DarkMuted",
    brightness: 120,
    transition: 3,
  },
  {
    name: "party",
    label: "Party",
    primarySource: "Vibrant",
    secondarySource: "LightVibrant",
    brightness: 255,
    transition: 0.5,
  },
  {
    name: "cinema",
    label: "Cinema",
    primarySource: "DarkVibrant",
    secondarySource: "DarkMuted",
    brightness: 80,
    transition: 2,
  },
  {
    name: "focus",
    label: "Focus",
    primarySource: "LightVibrant",
    secondarySource: "Muted",
    brightness: 200,
    transition: 1.5,
  },
];
