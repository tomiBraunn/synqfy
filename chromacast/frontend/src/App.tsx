import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useNowPlaying } from "./hooks/useNowPlaying";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import AmbientBackground from "./components/AmbientBackground";
import CoverArt from "./components/CoverArt";
import ProgressBar from "./components/ProgressBar";
import PlayerControls from "./components/PlayerControls";
import VolumeControl from "./components/VolumeControl";
import QueuePanel from "./components/QueuePanel";
import LightPanel from "./components/LightPanel";
import TrackHistory from "./components/TrackHistory";
import MockLight from "./components/MockLight";
import ColorPalette from "./components/ColorPalette";
import Toast from "./components/Toast";
import Skeleton from "./components/Skeleton";
import ConfigForm from "./components/ConfigForm";
import "./App.css";

export default function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [enableLights, setEnableLights] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const { data, palette, trackId, trackChanged, clearTrackChanged, refresh } = useNowPlaying(
    authenticated && pageVisible && configured === true
  );
  const lastTrackRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    axios.get("/api/config").then(res => setConfigured(res.data.configured));
  }, []);

  useEffect(() => {
    if (configured) {
      axios.get("/auth/status").then(res => setAuthenticated(res.data.authenticated));
    }
  }, [configured]);

  useEffect(() => {
    if (trackChanged && data?.track) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast(`Now playing: ${data.track} — ${data.artist}`);
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        clearTrackChanged();
      }, 3500);
    }
  }, [trackChanged, data, clearTrackChanged]);

  useEffect(() => {
    if (trackId && trackId !== lastTrackRef.current) {
      lastTrackRef.current = trackId;
      if (enableLights) {
        axios.post("/api/lights/update").catch(() => {});
      }
    }
  }, [trackId, enableLights]);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!data) return;
    const endpoint = data.isPlaying ? "pause" : "play";
    axios.post(`/api/player/${endpoint}`).then(() => refresh()).catch(() => {});
  }, [data, refresh]);

  const handleNext = useCallback(() => {
    axios.post("/api/player/next").then(() => refresh()).catch(() => {});
  }, [refresh]);

  const handlePrevious = useCallback(() => {
    axios.post("/api/player/previous").then(() => refresh()).catch(() => {});
  }, [refresh]);

  const handleVolumeUp = useCallback(() => {
    const vol = Math.min(100, (data?.volume ?? 50) + 10);
    axios.put("/api/player/volume", { volume: vol }).then(() => refresh()).catch(() => {});
  }, [data, refresh]);

  const handleVolumeDown = useCallback(() => {
    const vol = Math.max(0, (data?.volume ?? 50) - 10);
    axios.put("/api/player/volume", { volume: vol }).then(() => refresh()).catch(() => {});
  }, [data, refresh]);

  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: handleNext,
    onPrevious: handlePrevious,
    onVolumeUp: handleVolumeUp,
    onVolumeDown: handleVolumeDown,
    enabled: authenticated && configured === true,
  });

  const handleLogin = () => {
    window.location.href = "/auth/login";
  };

  if (configured === null) {
    return <div className="app" />;
  }

  if (!configured) {
    return <ConfigForm onSaved={() => setConfigured(true)} />;
  }

  if (!authenticated) {
    return (
      <div className="app login-screen">
        <AmbientBackground palette={null} />
        <div className="login-content">
          <h1 className="app-title">chromacast</h1>
          <p className="app-subtitle">Sync your lights with Spotify</p>
          <button className="login-button" onClick={handleLogin}>
            Connect with Spotify
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <AmbientBackground palette={palette} />
      <Toast message={toast} />

      {!data?.playing && !data ? (
        <Skeleton />
      ) : data?.playing ? (
        <div className="main-layout">
          <CoverArt data={data} palette={palette} />

          <div className="controls-panel">
            <div className="track-info">
              <h1 className="track-name">{data.track}</h1>
              <p className="track-artist">{data.artist}</p>
              <p className="track-album">{data.album}</p>
            </div>

            <ProgressBar
              progressMs={data.progressMs ?? 0}
              durationMs={data.durationMs ?? 0}
              onSeek={refresh}
            />

            <PlayerControls
              isPlaying={data.isPlaying ?? false}
              onAction={refresh}
            />

            <VolumeControl initialVolume={data.volume ?? 50} />

            <ColorPalette palette={palette} />

            <LightPanel
              palette={palette}
              enabled={enableLights}
              onToggle={setEnableLights}
            />

            {!enableLights && <MockLight palette={palette} />}

            <QueuePanel />
            <TrackHistory />
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p className="disconnected">No track is currently playing</p>
        </div>
      )}
    </div>
  );
}
