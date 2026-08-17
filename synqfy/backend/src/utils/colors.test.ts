import { describe, it, expect } from "vitest";
import {
  rgbToKelvin,
  rgbToHsl,
  normalizeForLight,
  pickColors,
  Rgb,
  Swatch,
} from "./colors";

const sw = (rgb: Rgb, population: number): Swatch => ({ rgb, population });
const hue = (rgb: Rgb) => rgbToHsl(rgb)[0];
const hueGap = (a: Rgb, b: Rgb) => {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
};

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

describe("normalizeForLight", () => {
  it("conserva el matiz y lo lleva a brillo medio", () => {
    const [h] = rgbToHsl([60, 12, 12]); // rojo oscuro
    const out = normalizeForLight([60, 12, 12]);
    const [outH, outS, outL] = rgbToHsl(out);
    expect(Math.abs(outH - h)).toBeLessThan(2);
    expect(outS).toBeGreaterThanOrEqual(0.6);
    expect(outL).toBeCloseTo(0.5, 1);
  });

  it("un gris queda blanco en vez de inventar color", () => {
    expect(normalizeForLight([70, 72, 71])).toEqual([255, 255, 255]);
  });
});

describe("pickColors: fondo estilo Spotify", () => {
  it("prefiere lo vívido antes que lo dominante", () => {
    // Spotify pondera el colorido casi 6x más que la superficie.
    const { spotify } = pickColors([
      sw([150, 145, 140], 900), // beige apagado, 90% de la tapa
      sw([240, 20, 30], 100), // rojo vivo, 10%
    ]);
    expect(hueGap(spotify, [240, 20, 30])).toBeLessThan(10);
  });

  it("con dos colores igual de vívidos, gana el más oscuro", () => {
    const { spotify } = pickColors([
      sw([255, 120, 120], 500), // rojo claro
      sw([140, 20, 20], 500), // rojo oscuro
    ]);
    expect(rgbToHsl(spotify)[2]).toBeLessThan(0.4);
  });

  it("con todo lo demás igual, desempata la superficie", () => {
    const { spotify } = pickColors([
      sw([200, 40, 40], 100),
      sw([40, 40, 200], 900), // mismo colorido y luz, mucha más superficie
    ]);
    expect(hueGap(spotify, [40, 40, 200])).toBeLessThan(10);
  });

  it("evita el negro y el blanco puros", () => {
    const { spotify } = pickColors([
      sw([0, 0, 0], 900),
      sw([255, 255, 255], 800),
      sw([90, 40, 120], 50),
    ]);
    expect(spotify).toEqual([90, 40, 120]);
  });

  it("tapa en blanco y negro: fondo gris oscuro y las dos luces en blanco", () => {
    const { spotify, light } = pickColors([sw([51, 51, 52], 700), sw([180, 180, 180], 300)]);
    expect(rgbToHsl(spotify)[2]).toBeLessThan(0.3);
    expect(light.primary).toEqual([255, 255, 255]);
    // Antes el acento inventaba un naranja girando el matiz de un gris.
    expect(light.secondary).toEqual([255, 255, 255]);
  });
});

describe("blanco como color dominante", () => {
  it("tapa mayormente blanca: la luz va en blanco, no al detalle de color", () => {
    const { light } = pickColors([
      sw([248, 248, 246], 700), // fondo blanco, 70%
      sw([240, 30, 40], 150), // logo rojo, 15%
      sw([30, 30, 30], 150), // texto negro, 15%
    ]);
    expect(light.primary).toEqual([255, 255, 255]);
  });

  it("con la tapa blanca el acento sí toma el color que haya", () => {
    const { light } = pickColors([
      sw([248, 248, 246], 700),
      sw([240, 30, 40], 150),
      sw([30, 30, 30], 150),
    ]);
    expect(hueGap(light.secondary, [240, 30, 40])).toBeLessThan(10);
  });

  it("un fondo negro dominante no manda la luz a blanco: un foco no emite negro", () => {
    const { light } = pickColors([
      sw([12, 12, 14], 700), // fondo negro, 70%
      sw([240, 30, 40], 300), // rojo, 30%
    ]);
    expect(hueGap(light.primary, [240, 30, 40])).toBeLessThan(10);
  });

  it("si el color ocupa más que el blanco, gana el color", () => {
    const { light } = pickColors([
      sw([250, 250, 250], 300), // blanco, 30%
      sw([40, 90, 200], 700), // azul, 70%
    ]);
    expect(hueGap(light.primary, [40, 90, 200])).toBeLessThan(10);
  });
});

describe("pickColors: traducción a las lámparas", () => {
  it("la lámpara mantiene el matiz del fondo pero con brillo utilizable", () => {
    const { spotify, light } = pickColors([sw([84, 36, 44], 900), sw([30, 30, 30], 100)]);
    expect(rgbToHsl(spotify)[2]).toBeLessThan(0.3); // fondo oscuro, como Spotify
    expect(hueGap(light.primary, spotify)).toBeLessThan(5); // mismo matiz
    expect(rgbToHsl(light.primary)[2]).toBeCloseTo(0.5, 1); // pero emitible
  });

  it("descarta el casi negro para la lámpara aunque HSL le mida saturación alta", () => {
    // Caso real (TELEKINESIS): #04040c pintaba la casa de azul.
    const { light } = pickColors([sw([4, 4, 12], 500), sw([181, 74, 96], 100)]);
    expect(hueGap(light.primary, [181, 74, 96])).toBeLessThan(5);
  });

  it("el acento tiene un matiz distinto al principal", () => {
    const { light } = pickColors([sw([220, 40, 40], 500), sw([40, 90, 200], 400)]);
    expect(hueGap(light.primary, light.secondary)).toBeGreaterThanOrEqual(20);
  });

  it("gira el matiz del acento si la tapa es monocromática", () => {
    const { light } = pickColors([sw([220, 40, 40], 500), sw([120, 22, 22], 400)]);
    expect(hueGap(light.primary, light.secondary)).toBeGreaterThan(10);
  });

  it("sin colores usables cae a blanco", () => {
    expect(pickColors([]).light.primary).toEqual([255, 255, 255]);
  });
});
