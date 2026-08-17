import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useNowPlaying } from "./hooks/useNowPlaying";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import AmbientBackground from "./components/AmbientBackground";
import CoverArt from "./components/CoverArt";
import ProgressBar from "./components/ProgressBar";
import PlayerControls from "./components/PlayerControls";
import VolumeControl from "./components/VolumeControl";
import MediaTabs from "./components/MediaTabs";
import TopBar from "./components/TopBar";
import SettingsModal from "./components/SettingsModal";
import KioskView from "./components/KioskView";
import Toast from "./components/Toast";
import Skeleton from "./components/Skeleton";
import ConfigForm from "./components/ConfigForm";
import type { AppSettings } from "./types";
import "./App.css";

export default function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [kiosk, setKiosk] = useState(false);
  const { data, palette, trackId, trackChanged, clearTrackChanged, refresh } = useNowPlaying(
    authenticated && pageVisible && configured === true
  );
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
    if (configured && authenticated) {
      axios.get<AppSettings>("/api/settings").then(res => setSettings(res.data)).catch(() => {});
    }
  }, [configured, authenticated]);

  useEffect(() => {
    if (trackChanged && data?.track) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast(`${data.track} — ${data.artist}`);
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        clearTrackChanged();
      }, 3500);
    }
  }, [trackChanged, data, clearTrackChanged]);

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

  const toggleLights = useCallback(() => {
    axios.put<AppSettings>("/api/settings", { lightsEnabled: !settings?.lightsEnabled })
      .then(res => setSettings(res.data))
      .catch(() => setToast("No se pudo cambiar las luces"));
  }, [settings]);

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
        <AmbientBackground coverUrl={null} palette={null} />
        <div className="login-content">
          <h1 className="app-title">synqfy</h1>
          <p className="app-subtitle">Tus luces siguen a Spotify</p>
          <button className="login-button" onClick={handleLogin}>
            Conectar con Spotify
          </button>
        </div>
      </div>
    );
  }

  if (kiosk && data?.playing) {
    return <KioskView data={data} palette={palette} onExit={() => setKiosk(false)} />;
  }

  return (
    <div className="app">
      <AmbientBackground
        coverUrl={data?.coverUrl ?? null}
        palette={palette}
        color={data?.spotifyColor ?? null}
      />
      <Toast message={toast} />
      <TopBar
        lightsEnabled={settings?.lightsEnabled ?? false}
        night={data?.night ?? false}
        onToggleLights={toggleLights}
        onOpenSettings={() => setSettingsOpen(true)}
        onEnterKiosk={() => setKiosk(true)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={setSettings} />

      {!data ? (
        <Skeleton />
      ) : (
        <main className="stage">
          {/* El panel lateral queda siempre disponible: elegir lámparas o mirar
              la cola no depende de que haya música sonando. */}
          <section className="player">
            {data.playing ? (
              <>
                <CoverArt data={data} palette={palette} />

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

                <PlayerControls isPlaying={data.isPlaying ?? false} onAction={refresh} />

                <VolumeControl initialVolume={data.volume ?? 50} />
              </>
            ) : (
              <p className="disconnected">No hay nada sonando en Spotify</p>
            )}
          </section>

          <aside className="side">
            <MediaTabs
              trackId={trackId}
              data={data}
              settings={settings}
              onSettingsChange={setSettings}
            />
          </aside>
        </main>
      )}
    </div>
  );
}
