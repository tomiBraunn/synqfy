import { IconFullscreen, IconGear } from "./icons";

interface TopBarProps {
  onOpenSettings: () => void;
  onEnterKiosk: () => void;
}

export default function TopBar({ onOpenSettings, onEnterKiosk }: TopBarProps) {
  return (
    <div className="top-bar">
      <button className="top-bar-btn" onClick={onEnterKiosk} title="Fullscreen" aria-label="Fullscreen mode">
        <IconFullscreen />
      </button>
      <button className="top-bar-btn" onClick={onOpenSettings} title="Settings" aria-label="Settings">
        <IconGear />
      </button>
    </div>
  );
}
