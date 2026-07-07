import { useState, useEffect, useRef } from "react";
import axios from "axios";
import type { LyricsData, NowPlayingData } from "../types";

interface LyricsViewProps {
  trackId: string | null;
  data: NowPlayingData;
}

export default function LyricsView({ trackId, data }: LyricsViewProps) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  // Interpola el progreso entre polls: progressMs es de cuando el backend
  // consultó a Spotify; progressAgeMs + tiempo desde que llegó la respuesta
  // lo traen al presente sin depender de sincronía de relojes.
  const liveProgress =
    (data.progressMs ?? 0) +
    (data.progressAgeMs ?? 0) +
    (data.isPlaying && data.receivedAt ? nowTs - data.receivedAt : 0);

  const active = lyrics?.synced ? currentLineIndex(lyrics.synced, liveProgress) : -1;

  useEffect(() => {
    if (!trackId) {
      setLyrics(null);
      return;
    }
    setLoading(true);
    setLyrics(null);
    axios.get<LyricsData>("/api/lyrics")
      .then(res => setLyrics(res.data))
      .catch(() => setLyrics({ synced: null, plain: null }))
      .finally(() => setLoading(false));
  }, [trackId]);

  useEffect(() => {
    if (!lyrics?.synced || !data.isPlaying) return;
    const t = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(t);
  }, [lyrics, data.isPlaying]);

  useEffect(() => {
    if (active >= 0) {
      activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [active]);

  if (loading) return <p className="lyrics-empty">Searching lyrics…</p>;
  if (!lyrics || (!lyrics.synced && !lyrics.plain)) {
    return <p className="lyrics-empty">No lyrics available</p>;
  }

  if (lyrics.synced) {
    return (
      <div className="lyrics-list">
        {lyrics.synced.map((line, i) => (
          <p
            key={`${line.timeMs}-${i}`}
            ref={i === active ? activeRef : null}
            className={`lyrics-line ${i === active ? "lyrics-active" : ""}`}
          >
            {line.text || "♪"}
          </p>
        ))}
      </div>
    );
  }

  return <pre className="lyrics-plain">{lyrics.plain}</pre>;
}

function currentLineIndex(lines: { timeMs: number }[], progressMs: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= progressMs) idx = i;
    else break;
  }
  return idx;
}
