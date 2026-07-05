import { useState, useEffect } from "react";
import axios from "axios";
import type { TrackHistoryEntry } from "../types";

function rgbToCss(rgb: [number, number, number] | null): string {
  if (!rgb) return "#333";
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function TrackHistory() {
  const [history, setHistory] = useState<TrackHistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    axios.get("/api/history").then(res => setHistory(res.data.history)).catch(() => {});
  }, [open]);

  return (
    <div className="history-panel">
      <button className="queue-toggle" onClick={() => setOpen(!open)}>
        {open ? "Hide history" : "Recent tracks"}
      </button>
      {open && (
        <div className="history-list">
          {history.length === 0 && <p className="queue-empty">No history yet</p>}
          {history.map(entry => (
            <div key={`${entry.id}-${entry.playedAt}`} className="history-item">
              {entry.coverUrl && (
                <img src={entry.coverUrl} alt="" className="history-cover" draggable={false} />
              )}
              <div className="history-info">
                <span className="history-track">{entry.track}</span>
                <span className="history-artist">{entry.artist}</span>
              </div>
              <div className="history-colors">
                {entry.palette?.Vibrant && (
                  <span className="history-color-dot" style={{ backgroundColor: rgbToCss(entry.palette.Vibrant) }} />
                )}
                {entry.palette?.Muted && (
                  <span className="history-color-dot" style={{ backgroundColor: rgbToCss(entry.palette.Muted) }} />
                )}
                {entry.palette?.DarkVibrant && (
                  <span className="history-color-dot" style={{ backgroundColor: rgbToCss(entry.palette.DarkVibrant) }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
