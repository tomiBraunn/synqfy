import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import configRoutes from "./routes/config";
import authRoutes from "./routes/auth";
import spotifyRoutes from "./routes/spotify";
import settingsRoutes from "./routes/settings";
import { loadSettings } from "./settings";
import { restoreSessionFromRefreshToken } from "./services/spotify";
import { startPoller } from "./services/poller";

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const isProd = process.env.NODE_ENV === "production";

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.use("/api/config", configRoutes);
app.use("/auth", authRoutes);
app.use("/api", spotifyRoutes);
app.use("/api/settings", settingsRoutes);

if (isProd) {
  const candidates = [
    path.resolve(__dirname, "../../cc-frontend/dist"),
    path.resolve(__dirname, "../../frontend/dist"),
  ];
  const distPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api/") && !req.path.startsWith("/auth/")) {
      res.sendFile(path.join(distPath, "index.html"));
    }
  });
} else {
  app.get("/", (_req, res) => {
    res.json({ app: "synqfy", status: "running" });
  });
}

loadSettings();
restoreSessionFromRefreshToken().then(restored => {
  if (restored) console.log("Spotify session restored from saved refresh token");
});
startPoller();

app.listen(PORT, () => {
  console.log(`synqfy backend running on http://localhost:${PORT}`);
});
