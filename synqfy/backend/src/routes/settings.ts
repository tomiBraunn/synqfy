import { Router, Request, Response } from "express";
import { getSettings, updateSettings, AppSettings } from "../settings";
import { onSettingsChange } from "../services/automation";

const router = Router();

// Los entity_id llegan del navegador y terminan en la URL de la API de HA
// (/api/states/<id>), así que solo aceptamos el formato dominio.objeto.
const ENTITY_ID = /^[a-z_]+\.[a-z0-9_]+$/;

// Nadie se autentica contra este backend: cualquiera en la red le puede pegar.
// El token de HA da control total de la casa y el client secret permite pedir
// tokens de Spotify, así que no salen nunca. La UI solo necesita saber si ya
// hay uno guardado para mostrarlo como configurado.
const SECRETS = ["haToken", "spotifyClientSecret"] as const;

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && ENTITY_ID.test(v));
}

export function publicSettings(): Record<string, unknown> {
  const s: Record<string, unknown> = { ...getSettings() };
  delete s.spotifyRefreshToken;
  const secretsSet = {
    haToken: !!s.haToken,
    spotifyClientSecret: !!s.spotifyClientSecret,
  };
  for (const field of SECRETS) s[field] = "";
  return { ...s, secretsSet };
}

export function sanitizePatch(body: unknown): Partial<AppSettings> {
  const patch = { ...(body as Partial<AppSettings>) };
  delete (patch as Record<string, unknown>).spotifyRefreshToken;
  delete (patch as Record<string, unknown>).secretsSet;

  // Un secreto vacío significa "dejalo como está": la UI nunca lo recibe, así
  // que tampoco puede devolvérnoslo al guardar el resto de los ajustes.
  for (const field of SECRETS) {
    if (!patch[field]) delete patch[field];
  }

  if (patch.pauseTimeoutSec !== undefined) {
    patch.pauseTimeoutSec = Math.max(1, Math.min(600, Number(patch.pauseTimeoutSec)));
  }
  if (patch.primaryEntityIds !== undefined) patch.primaryEntityIds = cleanIds(patch.primaryEntityIds);
  if (patch.secondaryEntityIds !== undefined) patch.secondaryEntityIds = cleanIds(patch.secondaryEntityIds);
  return patch;
}

router.get("/", (_req: Request, res: Response) => {
  res.json(publicSettings());
});

router.put("/", (req: Request, res: Response) => {
  const patch = sanitizePatch(req.body);
  if (patch.pauseAction !== undefined && patch.pauseAction !== "baseColor" && patch.pauseAction !== "off") {
    res.status(400).json({ error: "pauseAction must be 'baseColor' or 'off'" });
    return;
  }

  const before = getSettings();
  const after = updateSettings(patch);
  // Elegir lámparas, soltarlas o apagar la sincronización se ve al instante,
  // sin esperar al próximo track.
  onSettingsChange(before, after);
  res.json(publicSettings());
});

export default router;
