import { useEffect, useRef, useState } from "react";
import type { Palette } from "../types";

interface AmbientBackgroundProps {
  coverUrl: string | null;
  palette: Palette | null;
}

interface Layer {
  url: string;
  key: number;
}

function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function AmbientBackground({ coverUrl, palette }: AmbientBackgroundProps) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const keyRef = useRef(0);

  useEffect(() => {
    if (!coverUrl) return;
    setLayers(prev => {
      if (prev.length > 0 && prev[prev.length - 1].url === coverUrl) return prev;
      keyRef.current += 1;
      return [...prev.slice(-1), { url: coverUrl, key: keyRef.current }];
    });
  }, [coverUrl]);

  const vibrant = palette?.Vibrant ? rgbToCss(palette.Vibrant) : "rgb(29,185,84)";
  const dark = palette?.DarkVibrant ? rgbToCss(palette.DarkVibrant) : "rgb(10,10,10)";

  return (
    <div className="ambient-bg" aria-hidden="true">
      {layers.length === 0 && (
        <div
          className="ambient-bg-fallback"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 20% 30%, ${vibrant}22, transparent), radial-gradient(ellipse 70% 50% at 80% 70%, ${dark}44, transparent)`,
          }}
        />
      )}
      {layers.map((layer, i) => (
        <div
          key={layer.key}
          className={`ambient-bg-layer ${i === layers.length - 1 ? "ambient-bg-visible" : "ambient-bg-fading"}`}
          style={{ backgroundImage: `url(${layer.url})` }}
        />
      ))}
      <div className="ambient-bg-scrim" />
    </div>
  );
}
