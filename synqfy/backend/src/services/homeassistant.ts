import axios from "axios";
import { getSettings } from "../settings";
import { rgbToKelvin } from "../utils/colors";

export interface LightUpdateOptions {
  brightness?: number;
  transition?: number;
  colorOverride?: [number, number, number];
  primaryColorOverride?: [number, number, number];
  secondaryColorOverride?: [number, number, number];
  kelvin?: number; // si está presente, se manda color_temp_kelvin en vez de rgb_color
}

export async function updateLights(
  primaryColor: [number, number, number],
  secondaryColor: [number, number, number],
  options: LightUpdateOptions = {}
): Promise<void> {
  const s = getSettings();
  const haUrl = s.haUrl;
  const haToken = s.haToken;

  if (!haUrl || !haToken) {
    throw new Error("Home Assistant is not configured");
  }

  const primaryIds = s.primaryEntityIds;
  const secondaryIds = s.secondaryEntityIds;
  const allIds: string[] = [];

  const brightness = options.brightness ?? 255;
  const transition = options.transition ?? 1.5;
  const pColor = options.primaryColorOverride ?? options.colorOverride ?? primaryColor;
  const sColor = options.secondaryColorOverride ?? options.colorOverride ?? secondaryColor;

  const tasks: Promise<void>[] = [];

  for (const id of primaryIds) {
    tasks.push(sendColor(haUrl, haToken, id, pColor, brightness, transition, options.kelvin));
  }

  for (const id of secondaryIds) {
    tasks.push(sendColor(haUrl, haToken, id, sColor, brightness, transition, options.kelvin));
  }

  if (primaryIds.length === 0 && secondaryIds.length === 0 && allIds.length > 0) {
    for (const id of allIds) {
      tasks.push(sendColor(haUrl, haToken, id, pColor, brightness, transition, options.kelvin));
    }
  }

  if (tasks.length === 0) {
    throw new Error("No light entities configured");
  }

  await Promise.all(tasks);
}

async function sendColor(
  haUrl: string,
  haToken: string,
  entityId: string,
  rgb: [number, number, number],
  brightness: number,
  transition: number,
  kelvin?: number
): Promise<void> {
  await axios.post(
    `${haUrl}/api/services/light/turn_on`,
    {
      entity_id: entityId,
      ...(kelvin ? { color_temp_kelvin: kelvin } : { rgb_color: rgb }),
      brightness: brightness,
      transition: transition,
    },
    {
      headers: {
        Authorization: `Bearer ${haToken}`,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    }
  );
}

export async function getCurrentLightState(): Promise<{
  rgb: [number, number, number] | null;
  kelvin: number | null;
}> {
  const s = getSettings();
  if (!s.haUrl || !s.haToken) {
    throw new Error("Home Assistant is not configured");
  }
  const entityId = s.primaryEntityIds[0] ?? s.secondaryEntityIds[0];
  if (!entityId) {
    throw new Error("No light entities configured");
  }
  const res = await axios.get(`${s.haUrl}/api/states/${entityId}`, {
    headers: { Authorization: `Bearer ${s.haToken}` },
    timeout: 5000,
  });
  const attrs = res.data?.attributes ?? {};
  const rawRgb = attrs.rgb_color;
  const rgb = Array.isArray(rawRgb) && rawRgb.length === 3 ? (rawRgb as [number, number, number]) : null;
  // HA solo reporta color_temp_kelvin en modo temperatura; si la luz está en
  // modo color, estimamos los kelvin desde el RGB actual.
  const kelvin = typeof attrs.color_temp_kelvin === "number"
    ? attrs.color_temp_kelvin
    : rgb ? rgbToKelvin(rgb) : null;
  return { rgb, kelvin };
}

export async function turnOffAllLights(transition = 3): Promise<void> {
  const s = getSettings();
  if (!s.haUrl || !s.haToken) {
    throw new Error("Home Assistant is not configured");
  }
  const ids = [...s.primaryEntityIds, ...s.secondaryEntityIds];
  if (ids.length === 0) {
    throw new Error("No light entities configured");
  }
  await Promise.all(
    ids.map(id =>
      axios.post(
        `${s.haUrl}/api/services/light/turn_off`,
        { entity_id: id, transition },
        {
          headers: { Authorization: `Bearer ${s.haToken}`, "Content-Type": "application/json" },
          timeout: 5000,
        }
      )
    )
  );
}
