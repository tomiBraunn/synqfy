import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("axios", () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }), get: vi.fn() },
}));

import axios from "axios";
import { setEntitiesColor, updateLights } from "./homeassistant";
import { resetSettingsForTest, updateSettings } from "../settings";

const post = axios.post as unknown as ReturnType<typeof vi.fn>;

function bodies() {
  return post.mock.calls.map(call => ({ url: call[0] as string, body: call[1] as Record<string, unknown> }));
}

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "synqfy-ha-"));
  resetSettingsForTest();
  updateSettings({
    haUrl: "http://ha.local:8123",
    haToken: "tok",
    primaryEntityIds: ["light.a"],
    secondaryEntityIds: ["light.b", "light.c"],
  });
  vi.clearAllMocks();
});

describe("setEntitiesColor", () => {
  it("prende cada entidad con el color, brillo y transicion pedidos", async () => {
    await setEntitiesColor(["light.a", "light.b"], [10, 20, 30], { brightness: 120, transition: 3 });
    expect(bodies()).toEqual([
      {
        url: "http://ha.local:8123/api/services/light/turn_on",
        body: { entity_id: "light.a", rgb_color: [10, 20, 30], brightness: 120, transition: 3 },
      },
      {
        url: "http://ha.local:8123/api/services/light/turn_on",
        body: { entity_id: "light.b", rgb_color: [10, 20, 30], brightness: 120, transition: 3 },
      },
    ]);
  });

  it("manda temperatura en vez de rgb cuando hay kelvin", async () => {
    await setEntitiesColor(["light.a"], [10, 20, 30], { kelvin: 2700 });
    const body = bodies()[0].body;
    expect(body.color_temp_kelvin).toBe(2700);
    expect(body.rgb_color).toBeUndefined();
  });

  it("sin entidades no llama a Home Assistant", async () => {
    await setEntitiesColor([], [10, 20, 30]);
    expect(post).not.toHaveBeenCalled();
  });

  it("falla si Home Assistant no esta configurado", async () => {
    updateSettings({ haToken: "" });
    await expect(setEntitiesColor(["light.a"], [10, 20, 30])).rejects.toThrow(/not configured/);
  });
});

describe("updateLights", () => {
  it("manda el color principal a las primarias y el acento a las secundarias", async () => {
    await updateLights([255, 0, 0], [0, 0, 255], { brightness: 200, transition: 1.5 });
    const byEntity = Object.fromEntries(
      bodies().map(({ body }) => [body.entity_id as string, body.rgb_color])
    );
    expect(byEntity).toEqual({
      "light.a": [255, 0, 0],
      "light.b": [0, 0, 255],
      "light.c": [0, 0, 255],
    });
  });

  it("falla si no hay ninguna lampara elegida", async () => {
    updateSettings({ primaryEntityIds: [], secondaryEntityIds: [] });
    await expect(updateLights([1, 2, 3], [4, 5, 6])).rejects.toThrow(/No light entities/);
    expect(post).not.toHaveBeenCalled();
  });
});
