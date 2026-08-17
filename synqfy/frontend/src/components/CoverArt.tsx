import { useMemo } from "react";
import type { NowPlayingData, Palette } from "../types";
import { rgbToCss } from "../utils/rgb";

interface CoverArtProps {
  data: NowPlayingData;
  palette: Palette | null;
}

export default function CoverArt({ data, palette }: CoverArtProps) {
  // El halo alrededor de la tapa usa el mismo color que Spotify pone detrás.
  const glowColor = useMemo(() => {
    if (data.spotifyColor) return rgbToCss(data.spotifyColor);
    return palette?.Vibrant ? rgbToCss(palette.Vibrant) : "rgba(29,185,84,0.3)";
  }, [data.spotifyColor, palette]);

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
