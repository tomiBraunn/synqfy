import { Router, Request, Response } from "express";
import {
  getNowPlaying,
  skipToNext,
  skipToPrevious,
  pausePlayback,
  resumePlayback,
  getQueue,
  setVolume,
  seekToPosition,
} from "../services/spotify";
import { updateLights } from "../services/homeassistant";
import { extractPalette, pickLightColor, pickSecondaryColor, Palette } from "../utils/colors";
import {
  addToHistory,
  getHistory,
  PRESETS,
  getDefaultColor,
  setDefaultColor,
  isPausedTimeoutActive,
  setPausedTimeoutActive,
} from "../store";

const router = Router();

let lastTrackId: string | null = null;
let lastPalette: Palette | null = null;
let currentBrightness: number = 255;
let currentTransition: number = 1.5;
let activePreset: string | null = null;
let wasPlaying: boolean = true;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;

async function sendDefaultColor() {
  const color = getDefaultColor();
  try {
    await updateLights(color, color, {
      brightness: Math.min(currentBrightness, 120),
      transition: 3,
    });
  } catch (err: any) {
    console.error("Default color error:", err.message);
  }
}

async function sendTrackColors() {
  if (!lastPalette) return;
  const primary = pickLightColor(lastPalette);
  const secondary = pickSecondaryColor(lastPalette);
  try {
    await updateLights(primary, secondary, {
      brightness: currentBrightness,
      transition: currentTransition,
    });
  } catch (err: any) {
    console.error("Track color restore error:", err.message);
  }
}

router.get("/now-playing", async (_req: Request, res: Response) => {
  try {
    const data = await getNowPlaying();

    if (!data) {
      lastTrackId = null;
      lastPalette = null;
      res.json({ playing: false });
      return;
    }

    const trackChanged = data.id !== lastTrackId;

    if (trackChanged) {
      lastPalette = await extractPalette(data.coverUrl);
      lastTrackId = data.id;

      if (lastPalette) {
        addToHistory({
          id: data.id,
          track: data.track,
          artist: data.artist,
          album: data.album,
          coverUrl: data.coverUrl,
          playedAt: Date.now(),
          palette: lastPalette,
        });
      }
    }

    if (data.isPlaying && !wasPlaying) {
      wasPlaying = true;
      if (pauseTimer) {
        clearTimeout(pauseTimer);
        pauseTimer = null;
      }
      if (isPausedTimeoutActive()) {
        setPausedTimeoutActive(false);
        sendTrackColors();
      }
    } else if (!data.isPlaying && wasPlaying) {
      wasPlaying = false;
      if (pauseTimer) clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => {
        setPausedTimeoutActive(true);
        sendDefaultColor();
      }, 5000);
    }

    res.json({
      id: data.id,
      track: data.track,
      artist: data.artist,
      album: data.album,
      coverUrl: data.coverUrl,
      progressMs: data.progressMs,
      durationMs: data.durationMs,
      volume: data.volume,
      palette: lastPalette,
    });
  } catch (err: any) {
    console.error("Now playing error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch currently playing track" });
  }
});

router.post("/lights/update", async (req: Request, res: Response) => {
  if (!lastPalette) {
    res.status(400).json({ error: "No palette available. Fetch /now-playing first." });
    return;
  }

  const { brightness, transition, primaryColor, secondaryColor } = req.body || {};

  if (typeof brightness === "number") currentBrightness = brightness;
  if (typeof transition === "number") currentTransition = transition;

  const primary = primaryColor
    ? primaryColor as [number, number, number]
    : pickLightColor(lastPalette);
  const secondary = secondaryColor
    ? secondaryColor as [number, number, number]
    : pickSecondaryColor(lastPalette);

  try {
    await updateLights(primary, secondary, {
      brightness: currentBrightness,
      transition: currentTransition,
      primaryColorOverride: primaryColor ? primary : undefined,
      secondaryColorOverride: secondaryColor ? secondary : undefined,
    });
    res.json({ success: true, primary, secondary, brightness: currentBrightness, transition: currentTransition });
  } catch (err: any) {
    console.error("HA update error:", err.message);
    res.json({ success: false, error: err.message, primary, secondary });
  }
});

router.post("/lights/brightness", async (req: Request, res: Response) => {
  const { brightness } = req.body;
  if (typeof brightness !== "number") {
    res.status(400).json({ error: "brightness (number) required" });
    return;
  }
  currentBrightness = Math.min(255, Math.max(1, brightness));
  res.json({ success: true, brightness: currentBrightness });
});

router.post("/lights/transition", async (req: Request, res: Response) => {
  const { transition } = req.body;
  if (typeof transition !== "number") {
    res.status(400).json({ error: "transition (number) required" });
    return;
  }
  currentTransition = Math.min(10, Math.max(0, transition));
  res.json({ success: true, transition: currentTransition });
});

router.get("/lights/default-color", (_req: Request, res: Response) => {
  res.json({ color: getDefaultColor() });
});

router.post("/lights/default-color", (req: Request, res: Response) => {
  const { color } = req.body;
  if (!Array.isArray(color) || color.length !== 3) {
    res.status(400).json({ error: "color ([r,g,b]) required" });
    return;
  }
  const rgb: [number, number, number] = [
    Math.min(255, Math.max(0, color[0])),
    Math.min(255, Math.max(0, color[1])),
    Math.min(255, Math.max(0, color[2])),
  ];
  setDefaultColor(rgb);
  res.json({ success: true, color: rgb });
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
  currentBrightness = preset.brightness;
  currentTransition = preset.transition;

  if (!lastPalette) {
    res.json({ success: true, preset: name, brightness: currentBrightness, transition: currentTransition });
    return;
  }

  const paletteAny = lastPalette as any;
  const primary = paletteAny[preset.primarySource] ?? pickLightColor(lastPalette);
  const secondary = paletteAny[preset.secondarySource] ?? pickSecondaryColor(lastPalette);

  try {
    await updateLights(primary, secondary, {
      brightness: currentBrightness,
      transition: currentTransition,
    });
    res.json({ success: true, preset: name, brightness: currentBrightness, transition: currentTransition });
  } catch (err: any) {
    res.json({ success: false, error: err.message, preset: name });
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
    console.error("Volume error:", err.response?.data || err.message);
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
    res.json({ success: true });
  } catch (err: any) {
    console.error("Seek error:", err.response?.data || err.message);
    res.json({ success: false, error: err.message });
  }
});

router.post("/player/next", async (_req: Request, res: Response) => {
  try {
    await skipToNext();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Skip error:", err.response?.data || err.message);
    res.json({ success: false, error: err.message });
  }
});

router.post("/player/previous", async (_req: Request, res: Response) => {
  try {
    await skipToPrevious();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Previous error:", err.response?.data || err.message);
    res.json({ success: false, error: err.message });
  }
});

router.post("/player/pause", async (_req: Request, res: Response) => {
  try {
    await pausePlayback();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Pause error:", err.response?.data || err.message);
    res.json({ success: false, error: err.message });
  }
});

router.post("/player/play", async (_req: Request, res: Response) => {
  try {
    await resumePlayback();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Play error:", err.response?.data || err.message);
    res.json({ success: false, error: err.message });
  }
});

export default router;
