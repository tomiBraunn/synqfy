export function rgbToCss(
  rgb: [number, number, number] | null | undefined,
  fallback = "transparent"
): string {
  return rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : fallback;
}
