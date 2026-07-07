import { useEffect, useRef, useState } from "react";
import type { NowPlayingData, Palette } from "../types";
import AmbientBackground from "./AmbientBackground";

interface KioskViewProps {
  data: NowPlayingData;
  palette: Palette | null;
  onExit: () => void;
}

export default function KioskView({ data, palette, onExit }: KioskViewProps) {
  const [cursorHidden, setCursorHidden] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handleMove = () => {
      setCursorHidden(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setCursorHidden(true), 3000);
    };
    handleMove();
    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return (
    <div className={`kiosk ${cursorHidden ? "kiosk-no-cursor" : ""}`} onClick={onExit}>
      <AmbientBackground coverUrl={data.coverUrl ?? null} palette={palette} />
      <div className="kiosk-content">
        {data.coverUrl && (
          <img src={data.coverUrl} alt="" className="kiosk-cover" draggable={false} />
        )}
        <h1 className="kiosk-track">{data.track}</h1>
        <p className="kiosk-artist">{data.artist}</p>
      </div>
    </div>
  );
}
