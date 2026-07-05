import { useState, useEffect } from "react";
import axios from "axios";
import type { QueueData } from "../types";

export default function QueuePanel() {
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    axios.get("/api/player/queue").then(res => setQueue(res.data)).catch(() => {});
  }, [open]);

  return (
    <div className="queue-panel">
      <button className="queue-toggle" onClick={() => setOpen(!open)}>
        {open ? "Hide queue" : "Show queue"}
      </button>
      {open && queue && (
        <div className="queue-list">
          {queue.queue.length === 0 && (
            <p className="queue-empty">No upcoming tracks</p>
          )}
          {queue.queue.map((item, i) => (
            <div key={`${item.id}-${i}`} className="queue-item">
              {item.coverUrl && (
                <img src={item.coverUrl} alt="" className="queue-item-cover" draggable={false} />
              )}
              <div className="queue-item-info">
                <span className="queue-item-track">{item.track}</span>
                <span className="queue-item-artist">{item.artist}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
