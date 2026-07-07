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
      headers: { "User-Agent": "synqfy (https://github.com/)" },
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
