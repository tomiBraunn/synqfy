import { useMemo } from "react";
import type { Palette } from "../types";

interface AmbientBackgroundProps {
  palette: Palette | null;
}

function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function AmbientBackground({ palette }: AmbientBackgroundProps) {
  const colors = useMemo(() => {
    const vibrant = palette?.Vibrant ? rgbToCss(palette.Vibrant) : "rgb(29,185,84)";
    const dark = palette?.DarkVibrant ? rgbToCss(palette.DarkVibrant) : "rgb(10,10,10)";
    const muted = palette?.Muted ? rgbToCss(palette.Muted) : "rgb(20,20,20)";
    return { vibrant, dark, muted };
  }, [palette]);

  return (
    <div
      className="ambient-bg"
      aria-hidden="true"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 20% 30%, ${colors.vibrant}22, transparent), radial-gradient(ellipse 70% 50% at 80% 70%, ${colors.dark}44, transparent), radial-gradient(ellipse 50% 40% at 50% 100%, ${colors.muted}33, transparent)`,
        transition: "background 2.5s ease",
      }}
    />
  );
}
