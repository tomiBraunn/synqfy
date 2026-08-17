import { getSettings, AppSettings } from "../settings";
import { applyLightColors, applyBaseColor, applyBaseColorTo, turnOff } from "./lightsController";
import type { LightColors } from "../utils/colors";

let currentLight: LightColors | null = null;
// null = todavía no sabemos qué está haciendo Spotify (arranque del backend).
let playing: boolean | null = null;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let pauseActionDone = false;

export function getAutomationState(): { pauseActionDone: boolean } {
  return { pauseActionDone };
}

function assignedIds(s: AppSettings): string[] {
  return [...s.primaryEntityIds, ...s.secondaryEntityIds];
}

function clearPauseTimer(): void {
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
}

function runPauseAction(): void {
  pauseActionDone = true;
  if (getSettings().pauseAction === "off") void turnOff();
  else void applyBaseColor();
}

// Al pausar (o al quedarse Spotify sin nada sonando) esperamos pauseTimeoutSec
// antes de soltar el color de la canción, para que un salto de track o un
// pausar-y-seguir no dispare un parpadeo.
function schedulePauseAction(): void {
  clearPauseTimer();
  if (pauseActionDone) return;
  pauseTimer = setTimeout(() => {
    pauseTimer = null;
    runPauseAction();
  }, getSettings().pauseTimeoutSec * 1000);
}

export function onTrackChange(light: LightColors | null): void {
  currentLight = light;
  if (!getSettings().lightsEnabled || !light) return;
  if (!pauseActionDone) {
    void applyLightColors(light);
  }
}

export function onPlayStateChange(isPlaying: boolean): void {
  if (isPlaying === playing) return;
  playing = isPlaying;
  clearPauseTimer();

  if (!isPlaying) {
    if (getSettings().lightsEnabled) schedulePauseAction();
    return;
  }

  if (!getSettings().lightsEnabled) {
    pauseActionDone = false;
    return;
  }
  if (pauseActionDone) {
    pauseActionDone = false;
    if (currentLight) void applyLightColors(currentLight);
  }
}

// Vuelve a mandar lo que las lámparas deberían estar mostrando ahora: el color
// de la portada, o el color base si ya se ejecutó la acción de pausa. Lo usan
// los sliders de brillo y transición.
export function reapply(): void {
  if (!getSettings().lightsEnabled) return;
  if (pauseActionDone) {
    runPauseAction();
    return;
  }
  if (currentLight) void applyLightColors(currentLight);
}

// Una lámpara que sale del grupo —rol "No", o apagar la sincronización entera—
// no se queda congelada con el color de la última canción: vuelve al color por
// defecto de ajustes.
export function onSettingsChange(before: AppSettings, after: AppSettings): void {
  const dropped = assignedIds(before).filter(id => !assignedIds(after).includes(id));

  if (before.lightsEnabled && !after.lightsEnabled) {
    clearPauseTimer();
    pauseActionDone = false;
    void applyBaseColorTo(assignedIds(before));
    return;
  }

  if (dropped.length > 0) void applyBaseColorTo(dropped);
  if (!after.lightsEnabled) return;

  if (playing === false) {
    // Se prende la sincronización con la música en pausa: no tiene sentido
    // pintar el color de la canción para apagarlo cinco segundos después.
    clearPauseTimer();
    runPauseAction();
    return;
  }
  reapply();
}

export function resetAutomationForTest(): void {
  clearPauseTimer();
  currentLight = null;
  playing = null;
  pauseActionDone = false;
}
