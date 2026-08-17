import { useEffect, useState } from "react";
import axios from "axios";
import type { AppSettings } from "../types";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (s: AppSettings) => void;
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export default function SettingsModal({ open, onClose, onSaved }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [readingLight, setReadingLight] = useState(false);
  const [lightError, setLightError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    axios.get<AppSettings>("/api/settings")
      .then(res => setSettings(res.data))
      .catch(() => setError("No se pudo cargar la configuración"));
  }, [open]);

  if (!open) return null;

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));

  const handleUseCurrent = async (mode: "rgb" | "kelvin") => {
    setReadingLight(true);
    setLightError("");
    try {
      const res = await axios.get<{ rgb: [number, number, number] | null; kelvin: number | null }>(
        "/api/lights/color"
      );
      if (mode === "kelvin") {
        if (res.data.kelvin == null) {
          setLightError("La luz no está en modo temperatura ahora");
        } else {
          set("defaultKelvin", res.data.kelvin);
        }
      } else {
        if (res.data.rgb == null) {
          setLightError("La luz no tiene color RGB ahora");
        } else {
          set("defaultColor", res.data.rgb);
        }
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.status === 404
        ? "La luz está apagada o no tiene color"
        : "No se pudo leer el estado de la luz";
      setLightError(msg);
    } finally {
      setReadingLight(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      // Las lámparas se eligen en la pestaña Luces; el modal no las pisa con
      // la copia que cargó al abrirse.
      const patch: Partial<AppSettings> = { ...settings };
      delete patch.primaryEntityIds;
      delete patch.secondaryEntityIds;
      const res = await axios.put<AppSettings>("/api/settings", patch);
      onSaved(res.data);
      onClose();
    } catch {
      setError("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configuración</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {!settings && !error && <p className="modal-loading">Cargando…</p>}
        {error && <p className="config-error">{error}</p>}

        {settings && (
          <div className="modal-body">
            <fieldset>
              <legend>Spotify</legend>
              <label>
                Client ID
                <input value={settings.spotifyClientId} onChange={e => set("spotifyClientId", e.target.value)} />
              </label>
              <label>
                Client Secret
                <input
                  type="password"
                  value={settings.spotifyClientSecret}
                  placeholder={settings.secretsSet?.spotifyClientSecret ? "•••••••• guardado" : "pegá el client secret"}
                  onChange={e => set("spotifyClientSecret", e.target.value)}
                />
                <span className="field-hint">Vacío = se mantiene el guardado.</span>
              </label>
              <label>
                Redirect URI
                <input value={settings.spotifyRedirectUri} onChange={e => set("spotifyRedirectUri", e.target.value)} />
              </label>
            </fieldset>

            <fieldset>
              <legend>Home Assistant</legend>
              <label>
                URL
                <input value={settings.haUrl} onChange={e => set("haUrl", e.target.value)} placeholder="http://homeassistant.local:8123" />
              </label>
              <label>
                Token
                <input
                  type="password"
                  value={settings.haToken}
                  placeholder={settings.secretsSet?.haToken ? "•••••••• guardado" : "pegá el long-lived token"}
                  onChange={e => set("haToken", e.target.value)}
                />
                <span className="field-hint">Vacío = se mantiene el guardado.</span>
              </label>
              <p className="field-hint">
                Qué lámpara usa cada color se elige en la pestaña <strong>Luces</strong>.
              </p>
            </fieldset>

            <fieldset>
              <legend>Color por defecto</legend>
              <p className="field-hint">
                Es a donde vuelven las lámparas cuando la música se pausa o se corta,
                cuando las ponés en No, y cuando apagás la sincronización.
              </p>
              <label>
                Al pausar
                <select
                  value={settings.pauseAction}
                  onChange={e => set("pauseAction", e.target.value as AppSettings["pauseAction"])}
                >
                  <option value="baseColor">Volver al color base</option>
                  <option value="off">Apagar las luces</option>
                </select>
              </label>
              <label>
                Segundos en pausa antes de volver al color base
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={settings.pauseTimeoutSec}
                  onChange={e => set("pauseTimeoutSec", Number(e.target.value))}
                />
              </label>
              <label>
                Brillo del color base ({Math.round((settings.pauseBrightness / 255) * 100)}%)
                <input
                  type="range"
                  min={1}
                  max={255}
                  value={settings.pauseBrightness}
                  onChange={e => set("pauseBrightness", Number(e.target.value))}
                />
              </label>
              <label>
                Modo del color base
                <select
                  value={settings.defaultKelvin != null ? "kelvin" : "rgb"}
                  onChange={e => set("defaultKelvin", e.target.value === "kelvin" ? 2700 : null)}
                >
                  <option value="rgb">Color RGB</option>
                  <option value="kelvin">Temperatura (Kelvin)</option>
                </select>
              </label>
              {settings.defaultKelvin == null ? (
                <label>
                  Color base
                  <div className="color-row">
                    <input
                      type="color"
                      value={rgbToHex(settings.defaultColor)}
                      onChange={e => set("defaultColor", hexToRgb(e.target.value))}
                    />
                    <button
                      type="button"
                      className="use-current-btn"
                      disabled={readingLight}
                      title="Usar el color actual real de las luces"
                      onClick={() => handleUseCurrent("rgb")}
                    >
                      {readingLight ? "Leyendo…" : "Usar actual"}
                    </button>
                  </div>
                </label>
              ) : (
                <label>
                  Temperatura base (K)
                  <div className="color-row">
                    <input
                      type="number"
                      min={1500}
                      max={9000}
                      step={50}
                      value={settings.defaultKelvin}
                      onChange={e => set("defaultKelvin", Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="use-current-btn"
                      disabled={readingLight}
                      title="Usar la temperatura actual real de las luces"
                      onClick={() => handleUseCurrent("kelvin")}
                    >
                      {readingLight ? "Leyendo…" : "Kelvins actuales"}
                    </button>
                  </div>
                </label>
              )}
              {lightError && <span className="config-error">{lightError}</span>}
            </fieldset>

            <fieldset>
              <legend>Modo nocturno</legend>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.nightMode.enabled}
                  onChange={e => set("nightMode", { ...settings.nightMode, enabled: e.target.checked })}
                />
                Activado
              </label>
              <label>
                Desde
                <input
                  type="time"
                  value={settings.nightMode.start}
                  onChange={e => set("nightMode", { ...settings.nightMode, start: e.target.value })}
                />
              </label>
              <label>
                Hasta
                <input
                  type="time"
                  value={settings.nightMode.end}
                  onChange={e => set("nightMode", { ...settings.nightMode, end: e.target.value })}
                />
              </label>
              <label>
                Brillo máximo ({Math.round((settings.nightMode.maxBrightness / 255) * 100)}%)
                <input
                  type="range"
                  min={1}
                  max={255}
                  value={settings.nightMode.maxBrightness}
                  onChange={e => set("nightMode", { ...settings.nightMode, maxBrightness: Number(e.target.value) })}
                />
              </label>
            </fieldset>

            <button className="login-button" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
