import { useState, useEffect } from "react";
import axios from "axios";
import type { QueueData, TrackHistoryEntry, NowPlayingData, AppSettings } from "../types";
import LyricsView from "./LyricsView";
import LightPanel from "./LightPanel";
import { formatTime } from "../utils/format";
import { rgbToCss } from "../utils/rgb";

type Tab = "queue" | "lyrics" | "lights" | "history";

const TABS: [Tab, string][] = [
  ["queue", "Cola"],
  ["lyrics", "Letra"],
  ["lights", "Luces"],
  ["history", "Historial"],
];

interface MediaTabsProps {
  trackId: string | null;
  data: NowPlayingData;
  settings: AppSettings | null;
  onSettingsChange: (s: AppSettings) => void;
}

export default function MediaTabs({ trackId, data, settings, onSettingsChange }: MediaTabsProps) {
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

  const upNext = queue?.queue ?? [];

  return (
    <div className="panel">
      <div className="panel-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`panel-tab ${tab === key ? "panel-tab-active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
            {key === "queue" && upNext.length > 0 && <span className="panel-tab-count">{upNext.length}</span>}
          </button>
        ))}
      </div>

      <div className={`panel-body ${tab === "lyrics" ? "panel-body-lyrics" : ""}`}>
        {tab === "queue" && (
          upNext.length === 0
            ? <p className="panel-msg">No hay nada en la cola</p>
            : <ol className="track-list">
                {upNext.map((item, i) => (
                  <li key={`${item.id}-${i}`} className="track-row">
                    <span className="track-index">{i + 1}</span>
                    {item.coverUrl && <img src={item.coverUrl} alt="" className="track-cover" draggable={false} />}
                    <span className="track-meta">
                      <span className="track-title">{item.track}</span>
                      <span className="track-sub">{item.artist}</span>
                    </span>
                    <span className="track-time">{formatTime(item.durationMs)}</span>
                  </li>
                ))}
              </ol>
        )}

        {tab === "lyrics" && <LyricsView trackId={trackId} data={data} />}

        {tab === "lights" && (
          <LightPanel data={data} settings={settings} onSettingsChange={onSettingsChange} />
        )}

        {tab === "history" && (
          history.length === 0
            ? <p className="panel-msg">Todavía no sonó nada</p>
            : <ul className="track-list">
                {history.map(item => (
                  <li key={`${item.id}-${item.playedAt}`} className="track-row">
                    {item.coverUrl && <img src={item.coverUrl} alt="" className="track-cover" draggable={false} />}
                    <span className="track-meta">
                      <span className="track-title">{item.track}</span>
                      <span className="track-sub">{item.artist}</span>
                    </span>
                    <span className="track-dots">
                      {[item.palette?.Vibrant, item.palette?.DarkVibrant, item.palette?.Muted]
                        .filter(Boolean)
                        .map((rgb, i) => (
                          <span key={i} className="track-dot" style={{ background: rgbToCss(rgb) }} />
                        ))}
                    </span>
                  </li>
                ))}
              </ul>
        )}
      </div>
    </div>
  );
}
