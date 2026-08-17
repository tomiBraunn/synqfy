import axios from "axios";
import { getSettings } from "../settings";
import { rgbToKelvin } from "../utils/colors";

export interface LightUpdateOptions {
  brightness?: number;
  transition?: number;
  kelvin?: number; // si está presente, se manda color_temp_kelvin en vez de rgb_color
}

// Pintar un conjunto puntual de lámparas: lo usan tanto la sincronización con
// la portada como la vuelta al color base de las que se sacan del grupo.
export async function setEntitiesColor(
  entityIds: string[],
  rgb: [number, number, number],
  options: LightUpdateOptions = {}
): Promise<void> {
  const s = getSettings();
  if (!s.haUrl || !s.haToken) {
    throw new Error("Home Assistant is not configured");
  }
  if (entityIds.length === 0) return;
  await Promise.all(
    entityIds.map(id =>
      sendColor(
        s.haUrl,
        s.haToken,
        id,
        rgb,
        options.brightness ?? 255,
        options.transition ?? 1.5,
        options.kelvin
      )
    )
  );
}

export async function updateLights(
  primaryColor: [number, number, number],
  secondaryColor: [number, number, number],
  options: LightUpdateOptions = {}
): Promise<void> {
  const s = getSettings();
  if (s.primaryEntityIds.length === 0 && s.secondaryEntityIds.length === 0) {
    throw new Error("No light entities configured");
  }
  await Promise.all([
    setEntitiesColor(s.primaryEntityIds, primaryColor, options),
    setEntitiesColor(s.secondaryEntityIds, secondaryColor, options),
  ]);
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

export interface HaLight {
  entityId: string;
  name: string;
  on: boolean;
}

export async function listLights(): Promise<HaLight[]> {
  const s = getSettings();
  if (!s.haUrl || !s.haToken) {
    throw new Error("Home Assistant is not configured");
  }
  const res = await axios.get(`${s.haUrl}/api/states`, {
    headers: { Authorization: `Bearer ${s.haToken}` },
    timeout: 8000,
  });
  const states = Array.isArray(res.data) ? res.data : [];
  return states
    .filter((e: any) => typeof e?.entity_id === "string" && e.entity_id.startsWith("light."))
    .map((e: any) => ({
      entityId: e.entity_id as string,
      name: (e.attributes?.friendly_name as string) || (e.entity_id as string).slice(6).replace(/_/g, " "),
      on: e.state === "on",
    }))
    .sort((a: HaLight, b: HaLight) => a.name.localeCompare(b.name));
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
