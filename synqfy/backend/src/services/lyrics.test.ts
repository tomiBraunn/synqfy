import { describe, it, expect } from "vitest";
import { parseLrc } from "./lyrics";

describe("parseLrc", () => {
  it("parsea lineas [mm:ss.xx]", () => {
    const lrc = "[00:12.34] Hola mundo\n[01:02.50] Segunda linea";
    expect(parseLrc(lrc)).toEqual([
      { timeMs: 12340, text: "Hola mundo" },
      { timeMs: 62500, text: "Segunda linea" },
    ]);
  });

  it("ignora metadata y lineas invalidas", () => {
    const lrc = "[ar:Artista]\n[ti:Titulo]\nsin timestamp\n[00:05.00] Real";
    expect(parseLrc(lrc)).toEqual([{ timeMs: 5000, text: "Real" }]);
  });

  it("soporta segundos sin decimales y texto vacio", () => {
    expect(parseLrc("[02:00] \n[02:03.1] X")).toEqual([
      { timeMs: 120000, text: "" },
      { timeMs: 123100, text: "X" },
    ]);
  });
});
