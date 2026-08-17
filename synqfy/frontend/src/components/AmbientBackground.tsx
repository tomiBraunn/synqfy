import { useEffect, useRef, useState } from "react";
import type { Palette } from "../types";
import { rgbToCss } from "../utils/rgb";

interface AmbientBackgroundProps {
  coverUrl: string | null;
  palette: Palette | null;
  /** El color extraído al estilo Spotify: es el que tiñe el fondo. */
  color?: [number, number, number] | null;
}

interface Layer {
  url: string;
  key: number;
}

export default function AmbientBackground({ coverUrl, palette, color }: AmbientBackgroundProps) {
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
  const tint = color ? rgbToCss(color) : null;

  return (
    <div className="ambient-bg" aria-hidden="true">
      {layers.length === 0 && !tint && (
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
      {/* Como el reproductor de Spotify: el color baja desde arriba y se apaga
          hacia el fondo, en vez de teñir la pantalla entera de punta a punta. */}
      {tint && (
        <div
          className="ambient-bg-tint"
          style={{ background: `linear-gradient(180deg, ${tint} 0%, transparent 65%)` }}
        />
      )}
      <div className="ambient-bg-scrim" />
    </div>
  );
}
