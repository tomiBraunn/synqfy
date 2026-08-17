import { updateLights, setEntitiesColor, turnOffAllLights } from "./homeassistant";
import { getSettings } from "../settings";
import { LightColors } from "../utils/colors";

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
  opts: { brightness?: number; transition?: number; kelvin?: number } = {}
): Promise<void> {
  try {
    await updateLights(primary, secondary, {
      brightness: cappedBrightness(opts.brightness ?? state.brightness),
      transition: opts.transition ?? state.transition,
      kelvin: opts.kelvin,
    });
    state.lastError = null;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  }
}

export async function applyLightColors(light: LightColors): Promise<void> {
  await applyColors(light.primary, light.secondary);
}

export async function applyBaseColor(): Promise<void> {
  const s = getSettings();
  await applyBaseColorTo([...s.primaryEntityIds, ...s.secondaryEntityIds]);
}

// Devuelve lámparas puntuales al color base de ajustes: es lo que pasa cuando
// una lámpara se saca del grupo o cuando se apaga la sincronización, sin tocar
// las que sí siguen la música.
export async function applyBaseColorTo(entityIds: string[]): Promise<void> {
  if (entityIds.length === 0) return;
  const { defaultColor, defaultKelvin, pauseBrightness } = getSettings();
  try {
    await setEntitiesColor(entityIds, defaultColor, {
      brightness: cappedBrightness(pauseBrightness),
      transition: 3,
      kelvin: defaultKelvin ?? undefined,
    });
    state.lastError = null;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  }
}

export async function turnOff(): Promise<void> {
  try {
    await turnOffAllLights(3);
    state.lastError = null;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  }
}
