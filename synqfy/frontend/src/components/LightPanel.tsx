import { useRef, useState } from "react";
import axios from "axios";
import type { NowPlayingData, AppSettings } from "../types";
import LampPicker from "./LampPicker";
import { rgbToCss } from "../utils/rgb";

interface LightPanelProps {
  data: NowPlayingData | null;
  settings: AppSettings | null;
  onSettingsChange: (s: AppSettings) => void;
}

export default function LightPanel({ data, settings, onSettingsChange }: LightPanelProps) {
  const [brightness, setBrightness] = useState(data?.brightness ?? 255);
  const [transition, setTransition] = useState(data?.transition ?? 1.5);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const colors = data?.lightColors ?? null;

  // El slider dispara decenas de eventos por arrastre y cada POST reaplica el
  // color en Home Assistant: mandamos solo el último valor de cada control.
  const push = (url: string, body: object) => {
    clearTimeout(timers.current[url]);
    timers.current[url] = setTimeout(() => { void axios.post(url, body).catch(() => {}); }, 150);
  };

  return (
    <div className="light-panel">
      {data?.lightsError && (
        <p className="light-error">Home Assistant no responde: {data.lightsError}</p>
      )}

      {colors && (
        <div className="light-colors">
          {([["Principal", colors.primary], ["Acento", colors.secondary]] as const).map(([label, rgb]) => (
            <div className="light-color" key={label}>
              <span className="light-color-chip" style={{ background: rgbToCss(rgb) }} />
              <span className="light-color-label">{label}</span>
            </div>
          ))}
          <span className="light-colors-note">tomados de la portada</span>
        </div>
      )}

      <div className="light-control-row">
        <label className="light-control-label" htmlFor="brightness">
          Brillo
          <span className="light-control-value">{Math.round((brightness / 255) * 100)}%</span>
        </label>
        <input
          id="brightness"
          type="range"
          min="1"
          max="255"
          value={brightness}
          onChange={e => {
            const v = Number(e.target.value);
            setBrightness(v);
            push("/api/lights/brightness", { brightness: v });
          }}
          className="light-slider"
        />
      </div>

      <div className="light-control-row">
        <label className="light-control-label" htmlFor="transition">
          Transición
          <span className="light-control-value">{transition.toFixed(1)}s</span>
        </label>
        <input
          id="transition"
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={transition}
          onChange={e => {
            const v = Number(e.target.value);
            setTransition(v);
            push("/api/lights/transition", { transition: v });
          }}
          className="light-slider"
        />
      </div>

      {settings
        ? <LampPicker settings={settings} colors={colors} onSettingsChange={onSettingsChange} />
        : <p className="lamp-picker-msg">Cargando ajustes…</p>}
    </div>
  );
}
