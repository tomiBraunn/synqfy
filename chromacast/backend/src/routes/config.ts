import { Router, Request, Response } from "express";
import { setConfig, isConfigured } from "../config";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({ configured: isConfigured() });
});

router.post("/", (req: Request, res: Response) => {
  const {
    spotifyClientId,
    spotifyClientSecret,
    spotifyRedirectUri,
    haUrl = "",
    haToken = "",
    primaryEntityIds = "",
    secondaryEntityIds = "",
  } = req.body;

  if (!spotifyClientId || !spotifyClientSecret || !spotifyRedirectUri) {
    res.status(400).json({ error: "Spotify Client ID, Secret and Redirect URI are required" });
    return;
  }

  setConfig({
    spotifyClientId,
    spotifyClientSecret,
    spotifyRedirectUri,
    haUrl,
    haToken,
    primaryEntityIds: primaryEntityIds.split(",").map((s: string) => s.trim()).filter(Boolean),
    secondaryEntityIds: secondaryEntityIds.split(",").map((s: string) => s.trim()).filter(Boolean),
  });

  res.json({ success: true });
});

export default router;
