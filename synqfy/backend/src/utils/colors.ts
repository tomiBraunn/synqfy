import Vibrant from "node-vibrant";

export type Rgb = [number, number, number];

export interface Palette {
  Vibrant: Rgb | null;
  DarkVibrant: Rgb | null;
  Muted: Rgb | null;
  DarkMuted: Rgb | null;
  LightVibrant: Rgb | null;
  LightMuted: Rgb | null;
}

export interface LightColors {
  primary: Rgb;
  secondary: Rgb;
}

export interface ExtractedColors {
  palette: Palette;
  /** El color que Spotify pone alrededor de la tapa: crudo, oscuro, tal cual. */
  spotify: Rgb;
  /** El mismo color traducido a algo que una lámpara puede emitir. */
  light: LightColors;
}

// Cuánto de la tapa ocupa cada color: sin esto, un detalle de 3 píxeles muy
// saturado le gana al color que uno diría que "es" la tapa.
export interface Swatch {
  rgb: Rgb;
  population: number;
}

const PALETTE_KEYS: (keyof Palette)[] = [
  "Vibrant",
  "DarkVibrant",
  "Muted",
  "DarkMuted",
  "LightVibrant",
  "LightMuted",
];

export function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = 60 * (((G - B) / d) % 6);
  else if (max === G) h = 60 * ((B - R) / d + 2);
  else h = 60 * ((R - G) / d + 4);
  return [(h + 360) % 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

// Umbral debajo del cual un swatch es gris: su matiz es ruido de compresión.
const GRAY_SAT = 0.12;


// Una lámpara controla el brillo por separado del color, así que un RGB oscuro
// (típico de DarkVibrant/DarkMuted) no da "rojo tenue": da rojo sucio a
// cualquier brillo. Normalizamos a L=0.5 y subimos saturación para que el foco
// emita el matiz real de la portada; el brillo lo pone el slider.
export function normalizeForLight(rgb: [number, number, number]): [number, number, number] {
  const [h, s] = rgbToHsl(rgb);
  if (s < GRAY_SAT) return [255, 255, 255];
  return hslToRgb(h, Math.min(1, Math.max(0.6, s * 1.3)), 0.5);
}

// Pesos del análisis de ingeniería inversa del color de fondo de Spotify
// (inobtenio.com): manda lo vívido, después lo oscuro, después la superficie.
// Por eso sus fondos son oscuros: están pensados para leer texto blanco encima.
const W_CHROMA = 4.92;
const W_DARKNESS = 1.41;
const W_DOMINANCE = 0.79;

/** Colorido real del pixel. A diferencia de la saturación HSL, no miente cerca
 *  del negro: #04040c da 0.03, no 0.5. */
function chroma([r, g, b]: Rgb): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function spotifyScore(swatch: Swatch, totalPopulation: number): number {
  // Usamos la L de HSL y no la luminancia perceptual a propósito: la segunda
  // haría que el azul gane siempre por ser físicamente más oscuro que el
  // amarillo, y la elección dejaría de ser sobre la tapa.
  const [, , l] = rgbToHsl(swatch.rgb);
  if (l < 0.02 || l > 0.98) return 0; // negro y blanco puros: Spotify los evita
  const share = totalPopulation > 0 ? swatch.population / totalPopulation : 0;
  return W_CHROMA * chroma(swatch.rgb) + W_DARKNESS * (1 - l) + W_DOMINANCE * share;
}

function hueDistance(a: Rgb, b: Rgb): number {
  const d = Math.abs(rgbToHsl(a)[0] - rgbToHsl(b)[0]);
  return Math.min(d, 360 - d);
}

/** Ordena los colores de la tapa como los ordenaría Spotify. */
function rankLikeSpotify(swatches: Swatch[]): Rgb[] {
  const total = swatches.reduce((acc, sw) => acc + sw.population, 0);
  return swatches
    .map(sw => ({ rgb: sw.rgb, score: spotifyScore(sw, total) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.rgb);
}

const WHITE: Rgb = [255, 255, 255];

// Por encima de esta luminosidad, un color sin croma es "blanco" para un foco:
// un gris claro y un blanco puro emiten lo mismo.
const WHITISH_L = 0.7;

/** Cuánta superficie de la tapa ocupa un grupo de colores. */
function share(swatches: Swatch[], total: number): number {
  if (total <= 0) return 0;
  return swatches.reduce((acc, sw) => acc + sw.population, 0) / total;
}

export function pickColors(swatches: Swatch[]): { spotify: Rgb; light: LightColors } {
  const ranked = rankLikeSpotify(swatches);
  const total = swatches.reduce((acc, sw) => acc + sw.population, 0);

  // Tres grupos por superficie: con color, blancos/claros, y oscuros sin color.
  const colored = swatches.filter(sw => chroma(sw.rgb) >= GRAY_SAT);
  const whitish = swatches.filter(
    sw => chroma(sw.rgb) < GRAY_SAT && rgbToHsl(sw.rgb)[2] >= WHITISH_L
  );
  const darkish = swatches.filter(
    sw => chroma(sw.rgb) < GRAY_SAT && rgbToHsl(sw.rgb)[2] < WHITISH_L
  );

  // Si lo que más ocupa la tapa es blanco, la luz va en blanco: es el color
  // dominante, no un "no encontré nada". El negro no entra en esta regla porque
  // un foco no puede emitirlo.
  const whiteWins = share(whitish, total) > share(colored, total)
    && share(whitish, total) > share(darkish, total);

  // Para el fondo seguimos el criterio de Spotify, que nunca usa blanco.
  const spotify = ranked[0] ?? [40, 40, 40];

  // Los grises crudos no sirven para un foco: dan luz sucia, no gris.
  const usable = ranked.filter(rgb => chroma(rgb) >= GRAY_SAT);

  if (whiteWins || usable.length === 0) {
    return {
      spotify,
      // Con la tapa en blanco (o sin ningún color usable) el acento acompaña:
      // si hay un color secundario real lo usa, si no también va blanco.
      light: { primary: WHITE, secondary: usable[0] ? normalizeForLight(usable[0]) : WHITE },
    };
  }

  const primary = usable[0];
  // El acento tiene que distinguirse; si la tapa es de un solo matiz, lo
  // giramos para que las dos zonas no queden idénticas.
  const distinct = usable.slice(1).find(rgb => hueDistance(rgb, primary) >= 20);
  const [h, s] = rgbToHsl(primary);

  return {
    spotify,
    light: {
      primary: normalizeForLight(primary),
      secondary: distinct
        ? normalizeForLight(distinct)
        : hslToRgb((h + 30) % 360, Math.min(1, Math.max(0.6, s * 1.3)), 0.5),
    },
  };
}

// CCT aproximada desde RGB (McCamy). Para colores saturados el resultado es
// solo orientativo, pero alcanza para "kelvins actuales" de una luz.
export function rgbToKelvin(rgb: [number, number, number]): number {
  const lin = rgb.map(c => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const [r, g, b] = lin;
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const sum = X + Y + Z;
  if (sum === 0) return 2700;
  const x = X / sum;
  const y = Y / sum;
  const n = (x - 0.332) / (0.1858 - y);
  const cct = 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
  return Math.round(Math.min(9000, Math.max(1500, cct)));
}

export async function extractPalette(imageUrl: string): Promise<ExtractedColors> {
  const vibrant = Vibrant.from(imageUrl)
    // Sin saltear píxeles y con más cubetas: el muestreo grueso por defecto
    // devolvía colores lavados y poblaciones poco confiables.
    .quality(1)
    .maxColorCount(128)
    .build();
  const raw = await vibrant.getPalette();

  const palette = {} as Palette;
  const named: Swatch[] = [];

  for (const key of PALETTE_KEYS) {
    const swatch = (raw as any)[key];
    const rgb = swatch ? (swatch.getRgb().map(Math.round) as Rgb) : null;
    palette[key] = rgb;
    if (rgb) named.push({ rgb, population: swatch.getPopulation() });
  }

  // Spotify puntúa todos los grupos de color de la imagen, no seis
  // representantes. node-vibrant los deja en _result.colors; si esa interna
  // cambia de nombre, caemos a los seis swatches con nombre.
  const clusters = (vibrant as any)._result?.colors;
  const swatches: Swatch[] = Array.isArray(clusters) && clusters.length > 0
    ? clusters.map((c: any) => ({ rgb: c.getRgb().map(Math.round) as Rgb, population: c.population }))
    : named;

  return { palette, ...pickColors(swatches) };
}
