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
  isNightNow,
} from "../services/lightsController";
import { reapply } from "../services/automation";
import { getCurrentLightState, listLights } from "../services/homeassistant";
import { getHistory } from "../store";
import { getLyrics } from "../services/lyrics";

const router = Router();

router.get("/now-playing", (_req: Request, res: Response) => {
  const snap = getSnapshot();
  const light = getLightState();

  if (!snap.playing) {
    res.json({
      playing: false,
      lightsError: light.lastError,
      night: isNightNow(),
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
    progressAgeMs: Date.now() - snap.fetchedAt,
    durationMs: snap.durationMs,
    volume: snap.volume,
    palette: snap.palette,
    // El color que Spotify pondría alrededor de la tapa, para el fondo.
    spotifyColor: snap.spotifyColor ?? null,
    // Lo que realmente reciben las lámparas, para que la UI muestre el color
    // final y no el swatch crudo de la portada.
    lightColors: snap.lightColors ?? null,
    brightness: light.brightness,
    transition: light.transition,
    lightsError: light.lastError,
    night: isNightNow(),
  });
});

router.post("/lights/brightness", (req: Request, res: Response) => {
  const { brightness } = req.body;
  if (typeof brightness !== "number") {
    res.status(400).json({ error: "brightness (number) required" });
    return;
  }
  setBrightness(brightness);
  reapply();
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

router.get("/lights/entities", async (_req: Request, res: Response) => {
  try {
    res.json({ lights: await listLights() });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to list lights" });
  }
});

router.get("/lights/color", async (_req: Request, res: Response) => {
  try {
    const state = await getCurrentLightState();
    if (!state.rgb && !state.kelvin) {
      res.status(404).json({ error: "Light is off or has no color" });
      return;
    }
    res.json(state);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to read light state" });
  }
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
