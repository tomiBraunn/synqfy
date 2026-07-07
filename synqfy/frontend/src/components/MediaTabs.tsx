import { useState, useEffect } from "react";
import axios from "axios";
import type { QueueData, TrackHistoryEntry, NowPlayingData } from "../types";
import LyricsView from "./LyricsView";

type Tab = "queue" | "lyrics" | "history";

interface MediaTabsProps {
  trackId: string | null;
  data: NowPlayingData;
}

export default function MediaTabs({ trackId, data }: MediaTabsProps) {
  const [tab, setTab] = useState<Tab>("queue");
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [history, setHistory] = useState<TrackHistoryEntry[]>([]);

  useEffect(() => {
    if (tab === "queue") {
      axios.get<QueueData>("/api/player/queue").then(res => setQueue(res.data)).catch(() => {});
    } else if (tab === "history") {
      axios.get<{ history: TrackHistoryEntry[] }>("/api/history")
        .then(res => setHistory(res.data.history))
        .catch(() => {});
    }
  }, [tab, trackId]);

  return (
    <div className="media-tabs">
      <div className="media-tabs-bar" role="tablist">
        {([
          ["queue", "Queue"],
          ["lyrics", "Lyrics"],
          ["history", "History"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`media-tab ${tab === key ? "media-tab-active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="media-tabs-content">
        {tab === "queue" && (
          <div className="queue-list">
            {(!queue || queue.queue.length === 0) && <p className="queue-empty">Nothing up next</p>}
            {queue?.queue.map((item, i) => (
              <div key={`${item.id}-${i}`} className="queue-item">
                {item.coverUrl && <img src={item.coverUrl} alt="" className="queue-item-cover" draggable={false} />}
                <div className="queue-item-info">
                  <span className="queue-item-track">{item.track}</span>
                  <span className="queue-item-artist">{item.artist}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "lyrics" && <LyricsView trackId={trackId} data={data} />}

        {tab === "history" && (
          <div className="queue-list">
            {history.length === 0 && <p className="queue-empty">No history yet</p>}
            {history.map(item => (
              <div key={`${item.id}-${item.playedAt}`} className="queue-item">
                {item.coverUrl && <img src={item.coverUrl} alt="" className="queue-item-cover" draggable={false} />}
                <div className="queue-item-info">
                  <span className="queue-item-track">{item.track}</span>
                  <span className="queue-item-artist">{item.artist}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
