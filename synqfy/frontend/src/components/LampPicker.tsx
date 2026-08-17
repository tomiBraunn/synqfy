import { useEffect, useState } from "react";
import axios from "axios";
import type { AppSettings, HaLight, LightColors } from "../types";
import { rgbToCss } from "../utils/rgb";
import { IconBulb } from "./icons";

type Role = "off" | "primary" | "secondary";

const ROLES: { key: Role; label: string }[] = [
  { key: "off", label: "No" },
  { key: "primary", label: "Principal" },
  { key: "secondary", label: "Acento" },
];

interface LampPickerProps {
  settings: AppSettings;
  colors: LightColors | null;
  onSettingsChange: (s: AppSettings) => void;
}

export default function LampPicker({ settings, colors, onSettingsChange }: LampPickerProps) {
  const [lamps, setLamps] = useState<HaLight[] | null>(null);
  const [error, setError] = useState("");
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    setError("");
    axios.get<{ lights: HaLight[] }>("/api/lights/entities")
      .then(res => alive && setLamps(res.data.lights))
      .catch(() => alive && setError("No pude leer las luces de Home Assistant. Revisá la URL y el token en ajustes."));
    return () => { alive = false; };
  }, [reloads]);

  const roleOf = (entityId: string): Role =>
    settings.primaryEntityIds.includes(entityId) ? "primary"
    : settings.secondaryEntityIds.includes(entityId) ? "secondary"
    : "off";

  const setRole = (entityId: string, role: Role) => {
    const primaryEntityIds = settings.primaryEntityIds.filter(id => id !== entityId);
    const secondaryEntityIds = settings.secondaryEntityIds.filter(id => id !== entityId);
    if (role === "primary") primaryEntityIds.push(entityId);
    if (role === "secondary") secondaryEntityIds.push(entityId);
    // Optimista: el segmento se mueve al toque y el backend confirma después.
    onSettingsChange({ ...settings, primaryEntityIds, secondaryEntityIds });
    axios.put<AppSettings>("/api/settings", { primaryEntityIds, secondaryEntityIds })
      .then(res => onSettingsChange(res.data))
      .catch(() => setError("No se pudo guardar el cambio"));
  };

  const dotColor = (role: Role) =>
    role === "primary" ? rgbToCss(colors?.primary, "#f5f5f5")
    : role === "secondary" ? rgbToCss(colors?.secondary, "#f5f5f5")
    : "#3a3a3a";

  if (error && !lamps) {
    return (
      <div className="lamp-picker-msg">
        <p>{error}</p>
        <button className="ghost-btn" onClick={() => setReloads(n => n + 1)}>Reintentar</button>
      </div>
    );
  }

  if (!lamps) return <p className="lamp-picker-msg">Buscando lámparas…</p>;

  if (lamps.length === 0) {
    return <p className="lamp-picker-msg">Home Assistant no reportó ninguna entidad <code>light.</code></p>;
  }

  return (
    <div className="lamp-picker">
      <p className="lamp-picker-hint">
        Elegí qué lámpara toma el color principal de la portada y cuál el acento.
        Las que pongas en <strong>No</strong> vuelven al color por defecto de ajustes.
      </p>
      {error && <p className="light-error">{error}</p>}
      <ul className="lamp-list">
        {lamps.map(lamp => {
          const role = roleOf(lamp.entityId);
          const color = dotColor(role);
          return (
            <li key={lamp.entityId} className={`lamp-row ${role !== "off" ? "lamp-row-active" : ""}`}>
              <span
                className="lamp-dot"
                style={{
                  color,
                  filter: role === "off" ? "none" : `drop-shadow(0 0 10px ${color})`,
                }}
              >
                <IconBulb />
              </span>
              <span className="lamp-name" title={lamp.entityId}>{lamp.name}</span>
              <span className="segmented" role="group" aria-label={`Rol de ${lamp.name}`}>
                {ROLES.map(r => (
                  <button
                    key={r.key}
                    className={`segmented-btn ${role === r.key ? "segmented-active" : ""}`}
                    aria-pressed={role === r.key}
                    onClick={() => setRole(lamp.entityId, r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
