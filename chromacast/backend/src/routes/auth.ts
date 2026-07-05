import { Router, Request, Response } from "express";
import axios from "axios";
import { setToken, isAuthenticated } from "../services/spotify";
import { getSettings } from "../settings";

const router = Router();

function getCredentials() {
  const s = getSettings();
  return {
    clientId: s.spotifyClientId,
    clientSecret: s.spotifyClientSecret,
    redirectUri: s.spotifyRedirectUri,
  };
}

router.get("/login", (_req: Request, res: Response) => {
  const { clientId, redirectUri } = getCredentials();
  const scope = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

router.get("/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).send("Missing authorization code");
    return;
  }

  try {
    const { clientId, clientSecret, redirectUri } = getCredentials();

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    setToken(
      tokenRes.data.access_token,
      tokenRes.data.refresh_token,
      tokenRes.data.expires_in
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(frontendUrl);
  } catch (err: any) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).send("Authentication failed");
  }
});

router.get("/status", (_req: Request, res: Response) => {
  res.json({ authenticated: isAuthenticated() });
});

export default router;
