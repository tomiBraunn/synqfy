import { updateLights, turnOffAllLights } from "./homeassistant";
import { getSettings } from "../settings";
import { Palette, pickLightColor, pickSecondaryColor } from "../utils/colors";

interface LightRunState {
  brightness: number;
  transition: number;
  lastError: string | null;
}

const state: LightRunState = { brightness: 255, transition: 1.5, lastError: null };

export function getLightState(): LightRunState {
  return state;
}

export function setBrightness(b: number): void {
  state.brightness = Math.min(255, Math.max(1, b));
}

export function setTransition(t: number): void {
  state.transition = Math.min(10, Math.max(0, t));
}

export function isNightNow(now: Date = new Date()): boolean {
  const { nightMode } = getSettings();
  if (!nightMode.enabled) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = nightMode.start.split(":").map(Number);
  const [eh, em] = nightMode.end.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

export function cappedBrightness(requested: number, now: Date = new Date()): number {
  if (!isNightNow(now)) return requested;
  return Math.min(requested, getSettings().nightMode.maxBrightness);
}

export async function applyColors(
  primary: [number, number, number],
  secondary: [number, number, number],
  opts: { brightness?: number; transition?: number } = {}
): Promise<void> {
  try {
    await updateLights(primary, secondary, {
      brightness: cappedBrightness(opts.brightness ?? state.brightness),
      transition: opts.transition ?? state.transition,
    });
    state.lastError = null;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  }
}

export async function applyPalette(palette: Palette): Promise<void> {
  await applyColors(pickLightColor(palette), pickSecondaryColor(palette));
}

export async function applyBaseColor(): Promise<void> {
  const { defaultColor } = getSettings();
  await applyColors(defaultColor, defaultColor, {
    brightness: Math.min(state.brightness, 120),
    transition: 3,
  });
}

export async function turnOff(): Promise<void> {
  try {
    await turnOffAllLights(3);
    state.lastError = null;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  }
}
