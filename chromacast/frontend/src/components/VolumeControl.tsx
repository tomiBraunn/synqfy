import { useState, useCallback } from "react";
import axios from "axios";

interface VolumeControlProps {
  initialVolume: number;
}

export default function VolumeControl({ initialVolume }: VolumeControlProps) {
  const [volume, setVolume] = useState(initialVolume);
  const [dragging, setDragging] = useState(false);

  const updateVolume = useCallback(async (vol: number) => {
    const clamped = Math.min(100, Math.max(0, vol));
    setVolume(clamped);
    try {
      await axios.put("/api/player/volume", { volume: clamped });
    } catch {
      // ignore
    }
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    updateVolume(Math.round(pct * 100));
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    updateVolume(Math.round(pct * 100));
  };

  return (
    <div className="volume-control">
      <button
        className="volume-icon"
        onClick={() => updateVolume(volume > 0 ? 0 : 50)}
        aria-label={volume > 0 ? "Mute" : "Unmute"}
      >
        {volume === 0 ? "\u{1F507}" : volume < 50 ? "\u{1F508}" : "\u{1F50A}"}
      </button>
      <div
        className="volume-slider-track"
        onClick={handleClick}
        onMouseDown={() => setDragging(true)}
        onMouseMove={handleDrag}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        role="slider"
        aria-valuenow={volume}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        <div className="volume-slider-fill" style={{ width: `${volume}%` }} />
        <div className="volume-slider-thumb" style={{ left: `${volume}%` }} />
      </div>
      <span className="volume-value">{volume}%</span>
    </div>
  );
}
