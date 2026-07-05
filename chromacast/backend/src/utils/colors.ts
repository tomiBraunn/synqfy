import Vibrant from "node-vibrant";

export interface Palette {
  Vibrant: [number, number, number] | null;
  DarkVibrant: [number, number, number] | null;
  Muted: [number, number, number] | null;
  DarkMuted: [number, number, number] | null;
  LightVibrant: [number, number, number] | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const match = hex.replace("#", "");
  return [
    parseInt(match.substring(0, 2), 16),
    parseInt(match.substring(2, 4), 16),
    parseInt(match.substring(4, 6), 16),
  ];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function pickLightColor(palette: Palette): [number, number, number] {
  if (palette.Vibrant && luminance(palette.Vibrant) > 0.1) {
    return palette.Vibrant;
  }
  if (palette.DarkVibrant) {
    return palette.DarkVibrant;
  }
  if (palette.Muted) {
    return palette.Muted;
  }
  return [255, 255, 255];
}

export function pickSecondaryColor(palette: Palette): [number, number, number] {
  if (palette.DarkVibrant) {
    return palette.DarkVibrant;
  }
  if (palette.Muted) {
    return palette.Muted;
  }
  if (palette.DarkMuted) {
    return palette.DarkMuted;
  }
  if (palette.LightVibrant) {
    return palette.LightVibrant;
  }
  return [255, 255, 255];
}

export async function extractPalette(imageUrl: string): Promise<Palette> {
  const palette = await Vibrant.from(imageUrl).getPalette();

  const extract = (key: string): [number, number, number] | null => {
    const swatch = (palette as any)[key];
    if (!swatch) return null;
    const hex = swatch.getHex();
    return hex ? hexToRgb(hex) : null;
  };

  return {
    Vibrant: extract("Vibrant"),
    DarkVibrant: extract("DarkVibrant"),
    Muted: extract("Muted"),
    DarkMuted: extract("DarkMuted"),
    LightVibrant: extract("LightVibrant"),
  };
}
