// Iconos SVG inline (currentColor) — sin emojis en la UI.
interface IconProps {
  size?: number;
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true as const,
  };
}

export function IconFullscreen({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  );
}

export function IconGear({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
    </svg>
  );
}

export function IconPrev({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 5h2v14H6zM20 5v14L9.5 12z" />
    </svg>
  );
}

export function IconNext({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M16 5h2v14h-2zM4 5v14l10.5-7z" />
    </svg>
  );
}

export function IconPlay({ size = 28 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  );
}

export function IconPause({ size = 28 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

export function IconVolume({ level, size = 18 }: IconProps & { level: "mute" | "low" | "high" }) {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" fill="currentColor" stroke="none" />
      {level === "mute" && <path d="m16 9 5 6M21 9l-5 6" />}
      {level !== "mute" && <path d="M14.5 9.5a4 4 0 0 1 0 5" />}
      {level === "high" && <path d="M17.5 7a8 8 0 0 1 0 10" />}
    </svg>
  );
}

export function IconMoon({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M21 13.5A8.5 8.5 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z" />
    </svg>
  );
}
