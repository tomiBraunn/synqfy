import type { NowPlayingData, Palette } from "../types";

function rgbToCss(rgb: [number, number, number] | null): string {
  if (!rgb) return "transparent";
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

interface NowPlayingProps {
  data: NowPlayingData;
  palette: Palette | null;
}

export default function NowPlaying({ data, palette }: NowPlayingProps) {
  const vibrantColor = palette?.Vibrant
    ? rgbToCss(palette.Vibrant)
    : "transparent";

  return (
    <div className="now-playing">
      {data.coverUrl && (
        <div
          className="cover-wrapper"
          style={{ boxShadow: `0 0 60px ${vibrantColor}40` }}
        >
          <img
            src={data.coverUrl}
            alt={`${data.album} cover`}
            className="cover-art"
          />
        </div>
      )}
      <div className="track-info">
        <p className="track-name">{data.track}</p>
        <p className="track-artist">{data.artist}</p>
      </div>
    </div>
  );
}
