import { useMemo } from "react";
import type { NowPlayingData, Palette } from "../types";

interface CoverArtProps {
  data: NowPlayingData;
  palette: Palette | null;
}

function rgbToCss(rgb: [number, number, number] | null): string {
  if (!rgb) return "transparent";
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function CoverArt({ data, palette }: CoverArtProps) {
  const glowColor = useMemo(() => {
    return palette?.Vibrant ? rgbToCss(palette.Vibrant) : "rgba(29,185,84,0.3)";
  }, [palette]);

  return (
    <div className="cover-panel">
      {data.coverUrl && (
        <div
          className="cover-art-wrapper"
          style={{ boxShadow: `0 0 80px 8px ${glowColor}55, 0 0 200px 40px ${glowColor}22` }}
        >
          <img
            src={data.coverUrl}
            alt={`${data.album} cover`}
            className="cover-art-img"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
