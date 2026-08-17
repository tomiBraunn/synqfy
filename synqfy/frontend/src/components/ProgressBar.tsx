import { useState, useRef, useCallback } from "react";
import axios from "axios";
import { formatTime } from "../utils/format";

interface ProgressBarProps {
  progressMs: number;
  durationMs: number;
  onSeek?: () => void;
}

export default function ProgressBar({ progressMs, durationMs, onSeek }: ProgressBarProps) {
  const [seeking, setSeeking] = useState(false);
  const [seekPos, setSeekPos] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  const percent = durationMs > 0 ? ((seeking ? seekPos : progressMs) / durationMs) * 100 : 0;

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if (!barRef.current || durationMs === 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, x / rect.width));
    const pos = Math.floor(pct * durationMs);
    setSeeking(true);
    setSeekPos(pos);
    try {
      await axios.put("/api/player/seek", { positionMs: pos });
      onSeek?.();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setSeeking(false), 300);
    }
  }, [durationMs, onSeek]);

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (!seeking || !barRef.current || durationMs === 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, x / rect.width));
    setSeekPos(Math.floor(pct * durationMs));
  }, [seeking, durationMs]);

  const displayProgress = seeking ? seekPos : progressMs;

  return (
    <div className="progress-bar-wrapper">
      <span className="progress-time">{formatTime(displayProgress)}</span>
      <div
        className="progress-bar-track"
        ref={barRef}
        onClick={handleClick}
        onMouseMove={handleDrag}
        onMouseUp={() => setSeeking(false)}
        onMouseLeave={() => setSeeking(false)}
        role="slider"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
        <div className="progress-bar-thumb" style={{ left: `${percent}%` }} />
      </div>
      <span className="progress-time">{formatTime(durationMs)}</span>
    </div>
  );
}
