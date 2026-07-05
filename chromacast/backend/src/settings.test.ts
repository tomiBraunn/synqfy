import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  getSettings,
  updateSettings,
  isConfigured,
  resetSettingsForTest,
} from "./settings";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromacast-test-"));
  process.env.DATA_DIR = tmpDir;
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.HA_URL;
  resetSettingsForTest();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.HA_URL;
});

describe("settings", () => {
  it("devuelve defaults cuando no hay archivo", () => {
    loadSettings();
    expect(getSettings().pauseTimeoutSec).toBe(5);
    expect(getSettings().pauseAction).toBe("baseColor");
    expect(getSettings().defaultColor).toEqual([255, 200, 150]);
    expect(getSettings().nightMode.enabled).toBe(false);
    expect(isConfigured()).toBe(false);
  });

  it("persiste updates y los recupera con loadSettings", () => {
    loadSettings();
    updateSettings({ pauseTimeoutSec: 12, pauseAction: "off", lightsEnabled: true });
    resetSettingsForTest();
    loadSettings();
    expect(getSettings().pauseTimeoutSec).toBe(12);
    expect(getSettings().pauseAction).toBe("off");
    expect(getSettings().lightsEnabled).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "config.json"), "utf8"));
    expect(onDisk.pauseTimeoutSec).toBe(12);
  });

  it("mergea nightMode parcialmente", () => {
    loadSettings();
    updateSettings({ nightMode: { ...DEFAULT_SETTINGS.nightMode, enabled: true, maxBrightness: 60 } });
    expect(getSettings().nightMode.enabled).toBe(true);
    expect(getSettings().nightMode.maxBrightness).toBe(60);
    expect(getSettings().nightMode.start).toBe("23:00");
  });

  it("las env vars tienen prioridad sobre lo guardado", () => {
    loadSettings();
    updateSettings({ spotifyClientId: "guardado", haUrl: "http://guardado:8123" });
    process.env.SPOTIFY_CLIENT_ID = "de-env";
    process.env.HA_URL = "http://de-env:8123";
    expect(getSettings().spotifyClientId).toBe("de-env");
    expect(getSettings().haUrl).toBe("http://de-env:8123");
  });

  it("isConfigured true con credenciales spotify", () => {
    loadSettings();
    updateSettings({
      spotifyClientId: "a",
      spotifyClientSecret: "b",
      spotifyRedirectUri: "http://localhost:3001/auth/callback",
    });
    expect(isConfigured()).toBe(true);
  });
});
