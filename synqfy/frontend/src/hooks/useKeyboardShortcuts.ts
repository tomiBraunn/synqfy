import { useEffect } from "react";

interface KeyboardShortcutHandlers {
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  enabled: boolean;
}

export function useKeyboardShortcuts({
  onPlayPause,
  onNext,
  onPrevious,
  onVolumeUp,
  onVolumeDown,
  enabled,
}: KeyboardShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          onPlayPause();
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            e.preventDefault();
            onNext();
          }
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            e.preventDefault();
            onPrevious();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          onVolumeUp();
          break;
        case "ArrowDown":
          e.preventDefault();
          onVolumeDown();
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onPlayPause, onNext, onPrevious, onVolumeUp, onVolumeDown, enabled]);
}
