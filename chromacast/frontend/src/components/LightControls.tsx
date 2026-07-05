import { useState } from "react";
import axios from "axios";
import type { LightUpdateResult } from "../types";

interface LightControlsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function LightControls({ enabled, onToggle }: LightControlsProps) {
  const [status, setStatus] = useState<string | null>(null);

  const handleSendToHa = async () => {
    setStatus("sending...");
    try {
      const res = await axios.post<LightUpdateResult>("/api/lights/update");
      if (res.data.success) {
        setStatus("Sent to Home Assistant");
      } else {
        setStatus(res.data.error || "Failed");
      }
    } catch {
      setStatus("Connection error");
    }
  };

  return (
    <div className="light-controls">
      <div className="toggle-row">
        <span className="toggle-label">
          {enabled ? "Home Assistant" : "Mock"}
        </span>
        <button
          className="toggle-button"
          onClick={() => onToggle(!enabled)}
        >
          <span className={`toggle-knob ${enabled ? "toggle-right" : "toggle-left"}`} />
        </button>
      </div>

      {enabled && (
        <button className="send-button" onClick={handleSendToHa}>
          Send color to lights
        </button>
      )}

      {status && <p className="light-status">{status}</p>}
    </div>
  );
}
