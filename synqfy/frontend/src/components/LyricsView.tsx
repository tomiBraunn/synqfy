import { useState, useEffect, useRef } from "react";
import axios from "axios";
import type { LyricsData, LyricLine, NowPlayingData } from "../types";

interface LyricsViewProps {
  trackId: string | null;
  data: NowPlayingData;
}

// La línea se termina de escribir antes de que arranque la siguiente, y nunca
// se estira más de MAX_REVEAL_MS cuando hay un silencio largo detrás.
const REVEAL_RATIO = 0.7;
const MAX_REVEAL_MS = 2600;

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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

  const synced = lyrics?.synced ?? null;
  const active = synced ? currentLineIndex(synced, liveProgress) : -1;

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
    if (!synced || !data.isPlaying) return;
    // 60ms: suficiente para que las letras aparezcan una a una sin saltos.
    const t = setInterval(() => setNowTs(Date.now()), reducedMotion ? 400 : 60);
    return () => clearInterval(t);
  }, [synced, data.isPlaying]);

  useEffect(() => {
    if (active >= 0) {
      activeRef.current?.scrollIntoView({
        block: "center",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }, [active]);

  if (loading) return <p className="lyrics-msg">Buscando la letra…</p>;
  if (!lyrics || (!lyrics.synced && !lyrics.plain)) {
    return <p className="lyrics-msg">No encontré la letra de este tema</p>;
  }

  if (!synced) return <pre className="lyrics-plain">{lyrics.plain}</pre>;

  const typed = active >= 0 ? revealedChars(synced, active, liveProgress) : 0;

  return (
    <div className="lyrics">
      {synced.map((line, i) => {
        const text = line.text || "♪";
        const isActive = i === active;
        const state = isActive ? "lyrics-line-active" : i < active ? "lyrics-line-past" : "lyrics-line-next";
        return (
          <p
            key={`${line.timeMs}-${i}`}
            ref={isActive ? activeRef : null}
            className={`lyrics-line ${state}`}
          >
            {isActive ? (
              <>
                <span>{text.slice(0, typed)}</span>
                {typed < text.length && <i className="lyrics-caret" aria-hidden="true" />}
                <span className="lyrics-pending">{text.slice(typed)}</span>
              </>
            ) : text}
          </p>
        );
      })}
    </div>
  );
}

function currentLineIndex(lines: LyricLine[], progressMs: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= progressMs) idx = i;
    else break;
  }
  return idx;
}

export function revealedChars(lines: LyricLine[], active: number, progressMs: number): number {
  const line = lines[active];
  const length = (line.text || "♪").length;
  if (reducedMotion) return length;
  const endMs = lines[active + 1]?.timeMs ?? line.timeMs + 3000;
  const span = Math.min(MAX_REVEAL_MS, (endMs - line.timeMs) * REVEAL_RATIO);
  if (span <= 0) return length;
  const pct = (progressMs - line.timeMs) / span;
  return Math.ceil(Math.min(1, Math.max(0, pct)) * length);
}
