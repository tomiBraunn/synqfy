import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import type { Palette } from "../types";

interface LightPanelProps {
  palette: Palette | null;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
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

const DEFAULT_COLOR_PRESETS: { label: string; color: [number, number, number] }[] = [
  { label: "Warm", color: [255, 200, 150] },
  { label: "Cool", color: [150, 200, 255] },
  { label: "White", color: [255, 255, 255] },
  { label: "Amber", color: [255, 160, 60] },
  { label: "Lavender", color: [200, 180, 255] },
];

export default function LightPanel({ palette, enabled, onToggle }: LightPanelProps) {
  const [brightness, setBrightness] = useState(255);
  const [transition, setTransition] = useState(1.5);
  const [primarySource, setPrimarySource] = useState<string>("Vibrant");
  const [secondarySource, setSecondarySource] = useState<string>("DarkVibrant");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [defaultColor, setDefaultColor] = useState<[number, number, number]>([255, 200, 150]);

  useEffect(() => {
    axios.get("/api/lights/default-color").then(res => {
      if (res.data.color) setDefaultColor(res.data.color);
    }).catch(() => {});
  }, []);

  const saveDefaultColor = useCallback(async (color: [number, number, number]) => {
    setDefaultColor(color);
    try {
      await axios.post("/api/lights/default-color", { color });
      setStatus("Default color saved");
    } catch {
      setStatus("Failed to save");
    }
    setTimeout(() => setStatus(null), 2000);
  }, []);

  const sendUpdate = useCallback(async () => {
    setStatus("Updating...");
    const paletteAny = palette as any;
    const primary = paletteAny?.[primarySource] ?? [255, 255, 255];
    const secondary = paletteAny?.[secondarySource] ?? [255, 255, 255];
    try {
      const res = await axios.post("/api/lights/update", {
        brightness,
        transition,
        primaryColor: primary,
        secondaryColor: secondary,
      });
      setStatus(res.data.success ? "Lights updated" : res.data.error || "Failed");
    } catch {
      setStatus("Connection error");
    }
    setTimeout(() => setStatus(null), 2500);
  }, [palette, primarySource, secondarySource, brightness, transition]);

  const applyPreset = async (name: string) => {
    setActivePreset(name);
    setStatus("Applying preset...");
    try {
      const res = await axios.post("/api/lights/preset", { name });
      if (res.data.success) {
        setBrightness(res.data.brightness);
        setTransition(res.data.transition);
        setStatus(`${name} applied`);
      } else {
        setStatus(res.data.error || "Failed");
      }
    } catch {
      setStatus("Connection error");
    }
    setTimeout(() => setStatus(null), 2500);
  };

  const handleBrightness = (val: number) => {
    setBrightness(val);
    axios.post("/api/lights/brightness", { brightness: val }).catch(() => {});
  };

  const handleTransition = (val: number) => {
    setTransition(val);
    axios.post("/api/lights/transition", { transition: val }).catch(() => {});
  };

  const presets = [
    { name: "relax", label: "Relax" },
    { name: "party", label: "Party" },
    { name: "cinema", label: "Cinema" },
    { name: "focus", label: "Focus" },
  ];

  return (
    <div className="light-panel">
      <div className="light-panel-header">
        <span className="light-panel-title">Lights</span>
        <button
          className={`toggle-button ${enabled ? "toggle-on" : ""}`}
          onClick={() => onToggle(!enabled)}
          aria-label="Toggle Home Assistant"
        >
          <span className={`toggle-knob ${enabled ? "toggle-right" : "toggle-left"}`} />
        </button>
      </div>

      {enabled && (
        <>
          <div className="light-presets">
            {presets.map(p => (
              <button
                key={p.name}
                className={`preset-btn ${activePreset === p.name ? "preset-active" : ""}`}
                onClick={() => applyPreset(p.name)}
              >
                {p.label}
              </button>
            ))}
          </div>

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
            <div className="color-picker-group">
              <span className="color-picker-label">Primary</span>
              <div className="color-picker-swatches">
                {COLOR_SOURCES.map(src => {
                  const color = palette?.[src.key];
                  return (
                    <button
                      key={src.key}
                      className={`color-swatch-btn ${primarySource === src.key ? "color-swatch-active" : ""}`}
                      style={{ backgroundColor: color ? rgbToCss(color) : "#333" }}
                      onClick={() => setPrimarySource(src.key)}
                      title={src.label}
                      aria-label={`Primary: ${src.label}`}
                      disabled={!color}
                    />
                  );
                })}
              </div>
            </div>

            <div className="color-picker-group">
              <span className="color-picker-label">Secondary</span>
              <div className="color-picker-swatches">
                {COLOR_SOURCES.map(src => {
                  const color = palette?.[src.key];
                  return (
                    <button
                      key={src.key}
                      className={`color-swatch-btn ${secondarySource === src.key ? "color-swatch-active" : ""}`}
                      style={{ backgroundColor: color ? rgbToCss(color) : "#333" }}
                      onClick={() => setSecondarySource(src.key)}
                      title={src.label}
                      aria-label={`Secondary: ${src.label}`}
                      disabled={!color}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="default-color-section">
            <span className="color-picker-label">Default color on pause (5s)</span>
            <div className="default-color-row">
              <input
                type="color"
                className="default-color-input"
                value={`#${defaultColor.map(c => c.toString(16).padStart(2, "0")).join("")}`}
                onChange={e => {
                  const hex = e.target.value;
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  saveDefaultColor([r, g, b]);
                }}
              />
              <div className="default-color-presets">
                {DEFAULT_COLOR_PRESETS.map(p => (
                  <button
                    key={p.label}
                    className="color-swatch-btn"
                    style={{ backgroundColor: rgbToCss(p.color) }}
                    onClick={() => saveDefaultColor(p.color)}
                    title={p.label}
                    aria-label={p.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <button className="send-button" onClick={sendUpdate}>
            Apply to lights
          </button>
        </>
      )}

      {status && <p className="light-status">{status}</p>}
    </div>
  );
}
