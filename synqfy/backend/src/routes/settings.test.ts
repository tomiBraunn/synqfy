import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("../services/automation", () => ({ onSettingsChange: vi.fn() }));

import { publicSettings, sanitizePatch } from "./settings";
import { resetSettingsForTest, updateSettings, getSettings } from "../settings";

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "synqfy-routes-"));
  resetSettingsForTest();
  updateSettings({
    haUrl: "http://ha.local:8123",
    haToken: "token-secreto-de-home-assistant",
    spotifyClientId: "id-publico",
    spotifyClientSecret: "secreto-de-spotify",
    spotifyRefreshToken: "refresh-secreto",
  });
});

describe("publicSettings", () => {
  it("nunca expone secretos: el endpoint no pide autenticacion", () => {
    const out = publicSettings();
    const serializado = JSON.stringify(out);
    expect(serializado).not.toContain("token-secreto-de-home-assistant");
    expect(serializado).not.toContain("secreto-de-spotify");
    expect(serializado).not.toContain("refresh-secreto");
  });

  it("avisa cuales ya estan configurados para que la UI lo muestre", () => {
    expect(publicSettings().secretsSet).toEqual({ haToken: true, spotifyClientSecret: true });
    updateSettings({ haToken: "" });
    expect(publicSettings().secretsSet).toEqual({ haToken: false, spotifyClientSecret: true });
  });

  it("sigue devolviendo lo no sensible", () => {
    const out = publicSettings() as Record<string, unknown>;
    expect(out.haUrl).toBe("http://ha.local:8123");
    expect(out.spotifyClientId).toBe("id-publico");
  });
});

describe("sanitizePatch", () => {
  it("un secreto vacio no borra el guardado", () => {
    const patch = sanitizePatch({ haToken: "", spotifyClientSecret: "", pauseTimeoutSec: 5 });
    expect(patch).not.toHaveProperty("haToken");
    expect(patch).not.toHaveProperty("spotifyClientSecret");
    updateSettings(patch);
    expect(getSettings().haToken).toBe("token-secreto-de-home-assistant");
  });

  it("un secreto nuevo si se guarda", () => {
    updateSettings(sanitizePatch({ haToken: "token-nuevo" }));
    expect(getSettings().haToken).toBe("token-nuevo");
  });

  it("no deja cambiar el refresh token desde el navegador", () => {
    expect(sanitizePatch({ spotifyRefreshToken: "robado" })).not.toHaveProperty("spotifyRefreshToken");
  });

  it("descarta entity ids con formato invalido", () => {
    const patch = sanitizePatch({
      primaryEntityIds: ["light.sala", "../../etc/passwd", "SWITCH.Mala", 42],
    });
    expect(patch.primaryEntityIds).toEqual(["light.sala"]);
  });

  it("clampea el timeout de pausa", () => {
    expect(sanitizePatch({ pauseTimeoutSec: 9999 }).pauseTimeoutSec).toBe(600);
    expect(sanitizePatch({ pauseTimeoutSec: 0 }).pauseTimeoutSec).toBe(1);
  });
});
