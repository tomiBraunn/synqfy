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
    LightMuted: [number, number, number] | null;
  } | null;
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
