import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import type { NowPlayingData, Palette } from "../types";

export function useNowPlaying(enabled: boolean) {
  const [data, setData] = useState<NowPlayingData | null>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [trackChanged, setTrackChanged] = useState<string | null>(null);
  const trackIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await axios.get<NowPlayingData>("/api/now-playing");
      const d = res.data;

      if (d.playing && d.id && d.id !== trackIdRef.current) {
        trackIdRef.current = d.id;
        setTrackId(d.id);
        setTrackChanged(d.id);
        if (d.palette) {
          setPalette(d.palette);
        }
      } else if (d.playing && d.palette) {
        setPalette(d.palette);
      }

      setData(d);
    } catch {
      // Not authenticated or network error
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    fetchNowPlaying();
    intervalRef.current = setInterval(fetchNowPlaying, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, fetchNowPlaying]);

  const clearTrackChanged = useCallback(() => setTrackChanged(null), []);

  return { data, palette, trackId, trackChanged, clearTrackChanged, refresh: fetchNowPlaying };
}
