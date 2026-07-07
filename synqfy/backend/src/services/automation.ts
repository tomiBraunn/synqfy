import { getSettings } from "../settings";
import { applyPalette, applyColors, applyBaseColor, turnOff } from "./lightsController";
import type { Palette } from "../utils/colors";

let currentPalette: Palette | null = null;
let playing = false;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let pauseActionDone = false;
let partyOn = false;
let partyTimer: ReturnType<typeof setInterval> | null = null;
let partyIndex = 0;

const PARTY_KEYS: (keyof Palette)[] = [
  "Vibrant",
  "LightVibrant",
  "Muted",
  "DarkVibrant",
  "DarkMuted",
];

export function getAutomationState(): { partyOn: boolean; pauseActionDone: boolean } {
  return { partyOn, pauseActionDone };
}

function clearPauseTimer(): void {
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
}

function stopPartyTimer(): void {
  if (partyTimer) {
    clearInterval(partyTimer);
    partyTimer = null;
  }
}

function partyTick(): void {
  if (!currentPalette) return;
  const colors = PARTY_KEYS
    .map(k => currentPalette![k])
    .filter((c): c is [number, number, number] => c !== null);
  if (colors.length === 0) return;
  const primary = colors[partyIndex % colors.length];
  const secondary = colors[(partyIndex + 1) % colors.length];
  partyIndex++;
  void applyColors(primary, secondary);
}

function startPartyTimer(): void {
  stopPartyTimer();
  partyTick();
  partyTimer = setInterval(partyTick, getSettings().partySpeedSec * 1000);
}

export function onTrackChange(palette: Palette | null): void {
  currentPalette = palette;
  partyIndex = 0;
  if (!getSettings().lightsEnabled || !palette) return;
  if (!partyOn && !pauseActionDone) {
    void applyPalette(palette);
  }
}

export function onPlayStateChange(isPlaying: boolean): void {
  if (isPlaying === playing) return;
  playing = isPlaying;

  if (isPlaying) {
    clearPauseTimer();
    if (getSettings().lightsEnabled) {
      if (pauseActionDone) {
        pauseActionDone = false;
        if (currentPalette && !partyOn) void applyPalette(currentPalette);
      }
      if (partyOn) startPartyTimer();
    } else {
      pauseActionDone = false;
    }
    return;
  }

  stopPartyTimer();
  if (!getSettings().lightsEnabled) return;
  clearPauseTimer();
  pauseTimer = setTimeout(() => {
    pauseActionDone = true;
    if (getSettings().pauseAction === "off") void turnOff();
    else void applyBaseColor();
  }, getSettings().pauseTimeoutSec * 1000);
}

export function setPartyMode(on: boolean): void {
  partyOn = on;
  if (on) {
    if (playing && getSettings().lightsEnabled) startPartyTimer();
    return;
  }
  stopPartyTimer();
  if (currentPalette && getSettings().lightsEnabled && !pauseActionDone) {
    void applyPalette(currentPalette);
  }
}

export function resetAutomationForTest(): void {
  clearPauseTimer();
  stopPartyTimer();
  currentPalette = null;
  playing = false;
  pauseActionDone = false;
  partyOn = false;
  partyIndex = 0;
}
