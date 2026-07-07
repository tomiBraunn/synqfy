import { describe, it, expect } from "vitest";
import { rgbToKelvin } from "./colors";

describe("rgbToKelvin", () => {
  it("blanco cálido da menos kelvin que blanco frío", () => {
    const warm = rgbToKelvin([255, 180, 107]); // ~2700K típico
    const cool = rgbToKelvin([255, 255, 255]); // ~6500K
    expect(warm).toBeLessThan(cool);
    expect(warm).toBeGreaterThanOrEqual(1500);
    expect(cool).toBeLessThanOrEqual(9000);
  });

  it("colores saturados quedan dentro del rango 1500-9000", () => {
    for (const rgb of [[255, 0, 0], [0, 255, 0], [0, 0, 255]] as [number, number, number][]) {
      const k = rgbToKelvin(rgb);
      expect(k).toBeGreaterThanOrEqual(1500);
      expect(k).toBeLessThanOrEqual(9000);
    }
    expect(rgbToKelvin([0, 0, 0])).toBe(2700); // fallback
  });
});
