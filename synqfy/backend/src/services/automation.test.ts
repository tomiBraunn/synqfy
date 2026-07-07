import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("./lightsController", () => ({
  applyPalette: vi.fn().mockResolvedValue(undefined),
  applyColors: vi.fn().mockResolvedValue(undefined),
  applyBaseColor: vi.fn().mockResolvedValue(undefined),
  turnOff: vi.fn().mockResolvedValue(undefined),
}));

import { applyPalette, applyColors, applyBaseColor, turnOff } from "./lightsController";
import {
  onTrackChange,
  onPlayStateChange,
  setPartyMode,
  getAutomationState,
  resetAutomationForTest,
} from "./automation";
import { resetSettingsForTest, updateSettings } from "../settings";
import type { Palette } from "../utils/colors";

const PALETTE: Palette = {
  Vibrant: [200, 30, 30],
  DarkVibrant: [80, 10, 10],
  Muted: [120, 100, 90],
  DarkMuted: [60, 50, 45],
  LightVibrant: [250, 180, 180],
};

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "synqfy-auto-"));
  vi.useFakeTimers();
  resetSettingsForTest();
  resetAutomationForTest();
  updateSettings({ lightsEnabled: true, pauseTimeoutSec: 5, partySpeedSec: 8 });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pausa", () => {
  it("ejecuta color base a los pauseTimeoutSec de pausar", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    expect(applyBaseColor).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(applyBaseColor).toHaveBeenCalledTimes(1);
    expect(getAutomationState().pauseActionDone).toBe(true);
  });

  it("apaga las luces cuando pauseAction es off", () => {
    updateSettings({ pauseAction: "off" });
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(5000);
    expect(turnOff).toHaveBeenCalledTimes(1);
    expect(applyBaseColor).not.toHaveBeenCalled();
  });

  it("cancela el timer si se reanuda antes del timeout", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(3000);
    onPlayStateChange(true);
    vi.advanceTimersByTime(10000);
    expect(applyBaseColor).not.toHaveBeenCalled();
  });

  it("restaura la paleta del track al reanudar despues del timeout", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    onPlayStateChange(false);
    vi.advanceTimersByTime(5000);
    vi.clearAllMocks();
    onPlayStateChange(true);
    expect(applyPalette).toHaveBeenCalledWith(PALETTE);
    expect(getAutomationState().pauseActionDone).toBe(false);
  });

  it("no hace nada con lightsEnabled false", () => {
    updateSettings({ lightsEnabled: false });
    onTrackChange(PALETTE);
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
    onTrackChange(PALETTE);
    expect(applyPalette).toHaveBeenCalledWith(PALETTE);
  });

  it("no aplica nada con luces desactivadas", () => {
    updateSettings({ lightsEnabled: false });
    onTrackChange(PALETTE);
    expect(applyPalette).not.toHaveBeenCalled();
  });
});

describe("modo fiesta", () => {
  it("rota colores cada partySpeedSec mientras suena", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    vi.clearAllMocks();
    setPartyMode(true);
    expect(applyColors).toHaveBeenCalledTimes(1); // tick inmediato
    vi.advanceTimersByTime(8000);
    expect(applyColors).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(16000);
    expect(applyColors).toHaveBeenCalledTimes(4);
  });

  it("se detiene al pausar y se retoma al reanudar", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    setPartyMode(true);
    vi.clearAllMocks();
    onPlayStateChange(false);
    vi.advanceTimersByTime(24000);
    expect(applyColors).not.toHaveBeenCalled();
    onPlayStateChange(true);
    vi.advanceTimersByTime(8000);
    expect(applyColors).toHaveBeenCalled();
  });

  it("al apagarlo vuelve a la paleta del track", () => {
    onTrackChange(PALETTE);
    onPlayStateChange(true);
    setPartyMode(true);
    vi.clearAllMocks();
    setPartyMode(false);
    expect(getAutomationState().partyOn).toBe(false);
    expect(applyPalette).toHaveBeenCalledWith(PALETTE);
    vi.advanceTimersByTime(30000);
    expect(applyColors).not.toHaveBeenCalled();
  });
});
