import { useState, useCallback } from "react";
import axios from "axios";
import type { Palette, NowPlayingData, AppSettings } from "../types";
import MockLight from "./MockLight";
import { IconMoon } from "./icons";

interface LightPanelProps {
  palette: Palette | null;
  data: NowPlayingData | null;
  settings: AppSettings | null;
  onSettingsChange: (s: AppSettings) => void;
}

function rgbToCss(rgb: [number, number, number] | null): string {
  if (!rgb) return "transparent";
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

const COLOR_SOURCES: { key: keyof Palette; label: string }[] = [
  { key: "Vibrant", label: "Vibrant" },
  { key: "DarkVibrant", label: "Dark Vibrant" },
  { key: "Muted", label: "Muted" },
  { key: "DarkMuted", label: "Dark Muted" },
  { key: "LightVibrant", label: "Light Vibrant" },
];

const PRESETS = [
  { name: "relax", label: "Relax" },
  { name: "party", label: "Party" },
  { name: "cinema", label: "Cinema" },
  { name: "focus", label: "Focus" },
];

export default function LightPanel({ palette, data, settings, onSettingsChange }: LightPanelProps) {
  const [brightness, setBrightness] = useState(255);
  const [transition, setTransition] = useState(1.5);
  const [primarySource, setPrimarySource] = useState<keyof Palette>("Vibrant");
  const [secondarySource, setSecondarySource] = useState<keyof Palette>("DarkVibrant");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const enabled = settings?.lightsEnabled ?? false;
  const party = data?.party ?? false;
  const night = data?.night ?? false;

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  const putSettings = useCallback(async (patch: Partial<AppSettings>) => {
    try {
      const res = await axios.put<AppSettings>("/api/settings", patch);
      onSettingsChange(res.data);
    } catch {
      flash("Couldn't save");
    }
  }, [onSettingsChange]);

  const toggleLights = () => putSettings({ lightsEnabled: !enabled });

  const toggleParty = async () => {
    try {
      await axios.post("/api/lights/party", { on: !party });
    } catch {
      flash("Connection error");
    }
  };

  const sendUpdate = async () => {
    const primary = palette?.[primarySource] ?? [255, 255, 255];
    const secondary = palette?.[secondarySource] ?? [255, 255, 255];
    try {
      const res = await axios.post("/api/lights/update", {
        brightness,
        transition,
        primaryColor: primary,
        secondaryColor: secondary,
      });
      flash(res.data.success ? "Lights updated" : res.data.error || "Failed");
    } catch {
      flash("Connection error");
    }
  };

  const applyPreset = async (name: string) => {
    setActivePreset(name);
    try {
      const res = await axios.post("/api/lights/preset", { name });
      if (res.data.success) {
        setBrightness(res.data.brightness);
        setTransition(res.data.transition);
        flash(`${name} applied`);
      } else {
        flash(res.data.error || "Failed");
      }
    } catch {
      flash("Connection error");
    }
  };

  const handleBrightness = (val: number) => {
    setBrightness(val);
    axios.post("/api/lights/brightness", { brightness: val }).catch(() => {});
  };

  const handleTransition = (val: number) => {
    setTransition(val);
    axios.post("/api/lights/transition", { transition: val }).catch(() => {});
  };

  return (
    <div className="light-panel">
      <div className="light-panel-header">
        <span className="light-panel-title">
          Lights {night && <span title="Night mode active"><IconMoon /></span>}
        </span>
        <button
          className={`toggle-button ${enabled ? "toggle-on" : ""}`}
          onClick={toggleLights}
          aria-label="Toggle light sync"
        >
          <span className={`toggle-knob ${enabled ? "toggle-right" : "toggle-left"}`} />
        </button>
      </div>

      {data?.lightsError && <p className="light-error">HA not responding: {data.lightsError}</p>}

      {enabled && (
        <>
          <div className="light-presets">
            {PRESETS.map(p => (
              <button
                key={p.name}
                className={`preset-btn ${activePreset === p.name ? "preset-active" : ""}`}
                onClick={() => applyPreset(p.name)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="light-panel-header">
            <span className="light-panel-title">Party mode</span>
            <button
              className={`toggle-button ${party ? "toggle-on" : ""}`}
              onClick={toggleParty}
              aria-label="Party mode"
            >
              <span className={`toggle-knob ${party ? "toggle-right" : "toggle-left"}`} />
            </button>
          </div>

          {settings && (
            <div className="light-control-row">
              <label className="light-control-label">
                Party speed
                <span className="light-control-value">{settings.partySpeedSec}s</span>
              </label>
              <input
                type="range"
                min="2"
                max="60"
                value={settings.partySpeedSec}
                onChange={e => putSettings({ partySpeedSec: Number(e.target.value) })}
                className="light-slider"
              />
            </div>
          )}

          <div className="light-control-row">
            <label className="light-control-label">
              Brightness
              <span className="light-control-value">{Math.round((brightness / 255) * 100)}%</span>
            </label>
            <input
              type="range"
              min="1"
              max="255"
              value={brightness}
              onChange={e => handleBrightness(Number(e.target.value))}
              className="light-slider"
            />
          </div>

          <div className="light-control-row">
            <label className="light-control-label">
              Transition
              <span className="light-control-value">{transition.toFixed(1)}s</span>
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={transition}
              onChange={e => handleTransition(Number(e.target.value))}
              className="light-slider"
            />
          </div>

          <div className="color-picker-section">
            {([
              ["Primary", primarySource, setPrimarySource],
              ["Secondary", secondarySource, setSecondarySource],
            ] as const).map(([label, source, setSource]) => (
              <div className="color-picker-group" key={label}>
                <span className="color-picker-label">{label}</span>
                <div className="color-picker-swatches">
                  {COLOR_SOURCES.map(src => {
                    const color = palette?.[src.key];
                    return (
                      <button
                        key={src.key}
                        className={`color-swatch-btn ${source === src.key ? "color-swatch-active" : ""}`}
                        style={{ backgroundColor: color ? rgbToCss(color) : "#333" }}
                        onClick={() => setSource(src.key)}
                        title={src.label}
                        aria-label={`${label}: ${src.label}`}
                        disabled={!color}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button className="send-button" onClick={sendUpdate}>
            Apply to lights
          </button>
        </>
      )}

      {!enabled && <MockLight palette={palette} />}

      {status && <p className="light-status">{status}</p>}
    </div>
  );
}
