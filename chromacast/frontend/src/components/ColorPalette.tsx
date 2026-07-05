import type { Palette } from "../types";

function rgbToHex(rgb: [number, number, number]): string {
  const [r, g, b] = rgb;
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

interface ColorPaletteProps {
  palette: Palette | null;
}

export default function ColorPalette({ palette }: ColorPaletteProps) {
  if (!palette) return null;

  const swatches: { label: string; color: [number, number, number] | null }[] = [
    { label: "Vibrant", color: palette.Vibrant },
    { label: "Dark Vibrant", color: palette.DarkVibrant },
    { label: "Muted", color: palette.Muted },
    { label: "Dark Muted", color: palette.DarkMuted },
    { label: "Light Vibrant", color: palette.LightVibrant },
  ];

  return (
    <div className="palette">
      {swatches.map((s) =>
        s.color ? (
          <div
            key={s.label}
            className="palette-swatch"
            style={{ backgroundColor: rgbToHex(s.color) }}
            title={s.label}
          >
            <span className="palette-tooltip">{rgbToHex(s.color)}</span>
          </div>
        ) : null
      )}
    </div>
  );
}
