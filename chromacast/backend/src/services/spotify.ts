import axios from "axios";
import { getSettings, updateSettings } from "../settings";

interface SpotifyToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let token: SpotifyToken | null = null;

function getClientCredentials() {
  const s = getSettings();
  return { clientId: s.spotifyClientId, clientSecret: s.spotifyClientSecret };
}

function isExpired(): boolean {
  if (!token) return true;
  return Date.now() >= token.expires_at;
}

async function refreshAccessToken(): Promise<void> {
  const { clientId, clientSecret } = getClientCredentials();
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token!.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await axios.post("https://accounts.spotify.com/api/token", params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  token!.access_token = res.data.access_token;
  token!.expires_at = Date.now() + res.data.expires_in * 1000;

  if (res.data.refresh_token) {
    token!.refresh_token = res.data.refresh_token;
    updateSettings({ spotifyRefreshToken: res.data.refresh_token });
  }
}

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

export function getToken(): SpotifyToken | null {
  return token;
}

export function isAuthenticated(): boolean {
  return token !== null;
}

async function getValidToken(): Promise<string> {
  if (isExpired()) {
    await refreshAccessToken();
  }
  return token!.access_token;
}

export async function getNowPlaying(): Promise<{
  id: string;
  track: string;
  artist: string;
  album: string;
  coverUrl: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  volume: number;
} | null> {
  const accessToken = await getValidToken();

  const res = await axios.get("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 204 || !res.data?.item) {
    return null;
  }

  const item = res.data.item;

  return {
    id: item.id,
    track: item.name,
    artist: item.artists.map((a: any) => a.name).join(", "),
    album: item.album.name,
    coverUrl: item.album.images[0]?.url ?? "",
    isPlaying: res.data.is_playing ?? false,
    progressMs: res.data.progress_ms ?? 0,
    durationMs: item.duration_ms ?? 0,
    volume: res.data.device?.volume_percent ?? 50,
  };
}

export async function getQueue(): Promise<{
  currentlyPlaying: { id: string; track: string; artist: string; coverUrl: string; durationMs: number } | null;
  queue: { id: string; track: string; artist: string; coverUrl: string; durationMs: number }[];
}> {
  const accessToken = await getValidToken();
  const res = await axios.get("https://api.spotify.com/v1/me/player/queue", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const mapItem = (item: any) => ({
    id: item.id,
    track: item.name,
    artist: item.artists.map((a: any) => a.name).join(", "),
    coverUrl: item.album?.images?.[0]?.url ?? "",
    durationMs: item.duration_ms ?? 0,
  });

  return {
    currentlyPlaying: res.data.currently_playing ? mapItem(res.data.currently_playing) : null,
    queue: (res.data.queue || []).map(mapItem),
  };
}

export async function setVolume(volumePercent: number): Promise<void> {
  const accessToken = await getValidToken();
  await axios.put(
    `https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.min(100, Math.max(0, volumePercent))}`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export async function seekToPosition(positionMs: number): Promise<void> {
  const accessToken = await getValidToken();
  await axios.put(
    `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.max(0, positionMs)}`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export async function skipToNext(): Promise<void> {
  const accessToken = await getValidToken();
  await axios.post("https://api.spotify.com/v1/me/player/next", null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function skipToPrevious(): Promise<void> {
  const accessToken = await getValidToken();
  await axios.post("https://api.spotify.com/v1/me/player/previous", null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function pausePlayback(): Promise<void> {
  const accessToken = await getValidToken();
  await axios.put("https://api.spotify.com/v1/me/player/pause", null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function resumePlayback(): Promise<void> {
  const accessToken = await getValidToken();
  await axios.put("https://api.spotify.com/v1/me/player/play", null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
