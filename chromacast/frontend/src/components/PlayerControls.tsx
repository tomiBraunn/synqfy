import { useState } from "react";
import axios from "axios";

interface PlayerControlsProps {
  isPlaying: boolean;
  onAction: () => void;
}

export default function PlayerControls({ isPlaying, onAction }: PlayerControlsProps) {
  const [busy, setBusy] = useState(false);

  const handleAction = async (endpoint: string) => {
    setBusy(true);
    try {
      await axios.post(`/api/player/${endpoint}`);
      onAction();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="player-controls">
      <button
        className="player-btn"
        onClick={() => handleAction("previous")}
        disabled={busy}
        aria-label="Previous track"
      >
        {"\u23EE"}
      </button>
      <button
        className="player-btn player-btn-main"
        onClick={() => handleAction(isPlaying ? "pause" : "play")}
        disabled={busy}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "\u23F8" : "\u25B6"}
      </button>
      <button
        className="player-btn"
        onClick={() => handleAction("next")}
        disabled={busy}
        aria-label="Next track"
      >
        {"\u23ED"}
      </button>
    </div>
  );
}
