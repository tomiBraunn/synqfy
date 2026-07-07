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
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let baseIntervalMs = 4000;
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

// Adaptativo: si la canción termina antes del próximo tick, pollear justo después
// del final para detectar el cambio de track casi al instante.
function scheduleNext(): void {
  if (!running) return;
  let delay = baseIntervalMs;
  const s = snapshot;
  if (s.playing && s.isPlaying && s.durationMs && s.progressMs !== undefined) {
    const remaining = s.durationMs - s.progressMs - (Date.now() - s.fetchedAt);
    if (remaining > 0 && remaining < baseIntervalMs) {
      delay = Math.max(remaining + 250, 500);
    }
  }
  timer = setTimeout(() => {
    void pollOnce().finally(scheduleNext);
  }, delay);
}

export function startPoller(intervalMs = 4000): void {
  if (running) return;
  running = true;
  baseIntervalMs = intervalMs;
  void pollOnce().finally(scheduleNext);
}

export function stopPoller(): void {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
}
