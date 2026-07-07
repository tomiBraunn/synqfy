import { Router, Request, Response } from "express";
import { getSettings, updateSettings, AppSettings } from "../settings";

const router = Router();

function publicSettings() {
  const s: Record<string, unknown> = { ...getSettings() };
  delete s.spotifyRefreshToken;
  return s;
}

router.get("/", (_req: Request, res: Response) => {
  res.json(publicSettings());
});

router.put("/", (req: Request, res: Response) => {
  const patch = { ...(req.body as Partial<AppSettings>) };
  delete (patch as Record<string, unknown>).spotifyRefreshToken;
  if (patch.pauseTimeoutSec !== undefined) {
    patch.pauseTimeoutSec = Math.max(1, Math.min(600, Number(patch.pauseTimeoutSec)));
  }
  if (patch.partySpeedSec !== undefined) {
    patch.partySpeedSec = Math.max(2, Math.min(120, Number(patch.partySpeedSec)));
  }
  if (patch.pauseAction !== undefined && patch.pauseAction !== "baseColor" && patch.pauseAction !== "off") {
    res.status(400).json({ error: "pauseAction must be 'baseColor' or 'off'" });
    return;
  }
  updateSettings(patch);
  res.json(publicSettings());
});

export default router;
