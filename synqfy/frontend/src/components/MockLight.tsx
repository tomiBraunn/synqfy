import type { Palette } from "../types";

function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

interface MockLightProps {
  palette: Palette | null;
}

export default function MockLight({ palette }: MockLightProps) {
  const color = palette?.Vibrant ?? [255, 255, 255];
  const cssColor = rgbToCss(color);

  return (
    <div className="mock-light-wrapper">
      <div
        className="mock-light"
        style={{
          backgroundColor: cssColor,
          boxShadow: `0 0 80px ${cssColor}`,
        }}
      />
      <p className="mock-light-label">Mock Light</p>
    </div>
  );
}
