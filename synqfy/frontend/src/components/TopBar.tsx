import { IconFullscreen, IconGear, IconBulb, IconMoon } from "./icons";

interface TopBarProps {
  lightsEnabled: boolean;
  night: boolean;
  onToggleLights: () => void;
  onOpenSettings: () => void;
  onEnterKiosk: () => void;
}

export default function TopBar({
  lightsEnabled,
  night,
  onToggleLights,
  onOpenSettings,
  onEnterKiosk,
}: TopBarProps) {
  return (
    <header className="topbar">
      <span className="brand">synqfy</span>

      <div className="topbar-actions">
        <button
          className={`lights-pill ${lightsEnabled ? "lights-pill-on" : ""}`}
          onClick={onToggleLights}
          aria-pressed={lightsEnabled}
          title={
            lightsEnabled
              ? "Las luces siguen la música"
              : "Las luces vuelven al color por defecto de ajustes"
          }
        >
          <IconBulb />
          <span>Luces</span>
          <span className="lights-pill-state">{lightsEnabled ? "on" : "off"}</span>
        </button>

        {night && (
          <span className="night-chip" title="Modo nocturno activo: brillo limitado">
            <IconMoon />
          </span>
        )}

        <button className="icon-btn" onClick={onEnterKiosk} title="Pantalla completa" aria-label="Pantalla completa">
          <IconFullscreen />
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title="Ajustes" aria-label="Ajustes">
          <IconGear />
        </button>
      </div>
    </header>
  );
}
