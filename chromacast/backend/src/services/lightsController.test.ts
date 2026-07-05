import { describe, it, expect, beforeEach } from "vitest";
import { isNightNow, cappedBrightness } from "./lightsController";
import { resetSettingsForTest, updateSettings, DEFAULT_SETTINGS } from "../settings";
import fs from "fs";
import os from "os";
import path from "path";

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2026, 6, 5);
  d.setHours(h, m, 0, 0);
  return d;
}

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "chromacast-lc-"));
  resetSettingsForTest();
});

describe("isNightNow", () => {
  it("false cuando nightMode.enabled es false", () => {
    expect(isNightNow(at("03:00"))).toBe(false);
  });

  it("rango simple 20:00-23:00", () => {
    updateSettings({ nightMode: { ...DEFAULT_SETTINGS.nightMode, enabled: true, start: "20:00", end: "23:00" } });
    expect(isNightNow(at("21:00"))).toBe(true);
    expect(isNightNow(at("19:59"))).toBe(false);
    expect(isNightNow(at("23:00"))).toBe(false);
  });

  it("rango que cruza medianoche 23:00-07:00", () => {
    updateSettings({ nightMode: { ...DEFAULT_SETTINGS.nightMode, enabled: true, start: "23:00", end: "07:00" } });
    expect(isNightNow(at("23:30"))).toBe(true);
    expect(isNightNow(at("03:00"))).toBe(true);
    expect(isNightNow(at("06:59"))).toBe(true);
    expect(isNightNow(at("07:00"))).toBe(false);
    expect(isNightNow(at("12:00"))).toBe(false);
  });
});

describe("cappedBrightness", () => {
  it("no clampa de dia", () => {
    expect(cappedBrightness(255, at("12:00"))).toBe(255);
  });

  it("clampa de noche al maxBrightness", () => {
    updateSettings({
      nightMode: { enabled: true, start: "23:00", end: "07:00", maxBrightness: 60 },
    });
    expect(cappedBrightness(255, at("02:00"))).toBe(60);
    expect(cappedBrightness(40, at("02:00"))).toBe(40);
  });
});
