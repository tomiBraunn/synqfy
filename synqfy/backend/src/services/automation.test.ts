import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("./lightsController", () => ({
  applyLightColors: vi.fn().mockResolvedValue(undefined),
  applyBaseColor: vi.fn().mockResolvedValue(undefined),
  applyBaseColorTo: vi.fn().mockResolvedValue(undefined),
  turnOff: vi.fn().mockResolvedValue(undefined),
}));

import { applyLightColors, applyBaseColor, applyBaseColorTo, turnOff } from "./lightsController";
import {
  onTrackChange,
  onPlayStateChange,
  onSettingsChange,
  reapply,
  getAutomationState,
  resetAutomationForTest,
} from "./automation";
import { resetSettingsForTest, updateSettings, getSettings } from "../settings";
import type { LightColors } from "../utils/colors";

const LIGHT: LightColors = {
  primary: [200, 30, 30],
  secondary: [30, 60, 200],
};

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "synqfy-auto-"));
  vi.useFakeTimers();
  resetSettingsForTest();
  resetAutomationForTest();
  updateSettings({
    lightsEnabled: true,
    pauseTimeoutSec: 5,
    primaryEntityIds: ["light.a"],
    secondaryEntityIds: ["light.b"],
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pausa", () => {
  it("ejecuta color base a los pauseTimeoutSec de pausar", () => {
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    onPlayStateChange(false);
    expect(applyBaseColor).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(applyBaseColor).toHaveBeenCalledTimes(1);
    expect(getAutomationState().pauseActionDone).toBe(true);
  });

  it("vuelve al color base aunque el backend arranque con la musica pausada", () => {
    // Primera señal de Spotify: pausado. Sin haber visto un "playing" antes.
    onTrackChange(LIGHT);
    onPlayStateChange(false);
    vi.advanceTimersByTime(5000);
    expect(applyBaseColor).toHaveBeenCalledTimes(1);
  });

  it("apaga las luces cuando pauseAction es off", () => {
    updateSettings({ pauseAction: "off" });
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(5000);
    expect(turnOff).toHaveBeenCalledTimes(1);
    expect(applyBaseColor).not.toHaveBeenCalled();
  });

  it("cancela el timer si se reanuda antes del timeout", () => {
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(3000);
    onPlayStateChange(true);
    vi.advanceTimersByTime(10000);
    expect(applyBaseColor).not.toHaveBeenCalled();
  });

  it("restaura la paleta del track al reanudar despues del timeout", () => {
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(5000);
    vi.clearAllMocks();
    onPlayStateChange(true);
    expect(applyLightColors).toHaveBeenCalledWith(LIGHT);
    expect(getAutomationState().pauseActionDone).toBe(false);
  });

  it("no hace nada con lightsEnabled false", () => {
    updateSettings({ lightsEnabled: false });
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(60000);
    expect(applyBaseColor).not.toHaveBeenCalled();
    expect(turnOff).not.toHaveBeenCalled();
  });
});

describe("cambio de track", () => {
  it("aplica la paleta si las luces estan activadas", () => {
    onPlayStateChange(true);
    onTrackChange(LIGHT);
    expect(applyLightColors).toHaveBeenCalledWith(LIGHT);
  });

  it("no aplica nada con luces desactivadas", () => {
    updateSettings({ lightsEnabled: false });
    onTrackChange(LIGHT);
    expect(applyLightColors).not.toHaveBeenCalled();
  });
});

describe("reapply", () => {
  it("reaplica la paleta actual", () => {
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    vi.clearAllMocks();
    reapply();
    expect(applyLightColors).toHaveBeenCalledWith(LIGHT);
  });

  it("mantiene el color base si ya se ejecuto la accion de pausa", () => {
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(5000);
    vi.clearAllMocks();
    reapply();
    expect(applyBaseColor).toHaveBeenCalledTimes(1);
    expect(applyLightColors).not.toHaveBeenCalled();
  });

  it("no toca las luces si estan desactivadas", () => {
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    updateSettings({ lightsEnabled: false });
    vi.clearAllMocks();
    reapply();
    expect(applyLightColors).not.toHaveBeenCalled();
  });
});

describe("cambios de ajustes", () => {
  it("una lampara que pasa a 'No' vuelve al color base", () => {
    const before = getSettings();
    const after = updateSettings({ secondaryEntityIds: [] });
    onSettingsChange(before, after);
    expect(applyBaseColorTo).toHaveBeenCalledWith(["light.b"]);
  });

  it("apagar la sincronizacion devuelve todas las lamparas al color base", () => {
    const before = getSettings();
    const after = updateSettings({ lightsEnabled: false });
    onSettingsChange(before, after);
    expect(applyBaseColorTo).toHaveBeenCalledWith(["light.a", "light.b"]);
  });

  it("prender la sincronizacion con la musica pausada va directo al color base", () => {
    updateSettings({ lightsEnabled: false });
    onTrackChange(LIGHT);
    onPlayStateChange(false);
    const before = getSettings();
    const after = updateSettings({ lightsEnabled: true });
    vi.clearAllMocks();
    onSettingsChange(before, after);
    expect(applyBaseColor).toHaveBeenCalledTimes(1);
    expect(applyLightColors).not.toHaveBeenCalled();
  });

  it("agregar una lampara con musica sonando la pinta con la paleta", () => {
    onTrackChange(LIGHT);
    onPlayStateChange(true);
    const before = getSettings();
    const after = updateSettings({ primaryEntityIds: ["light.a", "light.c"] });
    vi.clearAllMocks();
    onSettingsChange(before, after);
    expect(applyBaseColorTo).not.toHaveBeenCalled();
    expect(applyLightColors).toHaveBeenCalledWith(LIGHT);
  });
});
