import axios from "axios";
import { getConfig } from "../config";

function parseIds(env: string | undefined): string[] {
  return (env || "").split(",").map((s: string) => s.trim()).filter(Boolean);
}

export interface LightUpdateOptions {
  brightness?: number;
  transition?: number;
  colorOverride?: [number, number, number];
  primaryColorOverride?: [number, number, number];
  secondaryColorOverride?: [number, number, number];
}

export async function updateLights(
  primaryColor: [number, number, number],
  secondaryColor: [number, number, number],
  options: LightUpdateOptions = {}
): Promise<void> {
  const cfg = getConfig();
  const haUrl = cfg?.haUrl || process.env.HA_URL;
  const haToken = cfg?.haToken || process.env.HA_TOKEN;

  if (!haUrl || !haToken) {
    throw new Error("Home Assistant is not configured");
  }

  const primaryIds = cfg?.primaryEntityIds?.length
    ? cfg.primaryEntityIds
    : parseIds(process.env.HA_ENTITY_IDS_PRIMARY || process.env.HA_ENTITY_ID);

  const secondaryIds = cfg?.secondaryEntityIds?.length
    ? cfg.secondaryEntityIds
    : parseIds(process.env.HA_ENTITY_IDS_SECONDARY);

  const allIds = parseIds(process.env.HA_ENTITY_IDS);

  const brightness = options.brightness ?? 255;
  const transition = options.transition ?? 1.5;
  const pColor = options.primaryColorOverride ?? options.colorOverride ?? primaryColor;
  const sColor = options.secondaryColorOverride ?? options.colorOverride ?? secondaryColor;

  const tasks: Promise<void>[] = [];

  for (const id of primaryIds) {
    tasks.push(sendColor(haUrl, haToken, id, pColor, brightness, transition));
  }

  for (const id of secondaryIds) {
    tasks.push(sendColor(haUrl, haToken, id, sColor, brightness, transition));
  }

  if (primaryIds.length === 0 && secondaryIds.length === 0 && allIds.length > 0) {
    for (const id of allIds) {
      tasks.push(sendColor(haUrl, haToken, id, pColor, brightness, transition));
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
  transition: number
): Promise<void> {
  await axios.post(
    `${haUrl}/api/services/light/turn_on`,
    {
      entity_id: entityId,
      rgb_color: rgb,
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
