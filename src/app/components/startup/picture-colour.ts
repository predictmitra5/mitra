/*
 * The colours a picture glows with on hover (DECISIONS.md 2026-11-16, "The
 * hover glow takes its colours from the picture"): the owner asked for the
 * highlight to match each thumbnail, so the panel tint and glow come from the
 * picture itself rather than the startup's set colour.
 *
 * The part of the picture the card shows (16:9, cropped like object-fit:
 * cover) is shrunk to a few hundred pixels and each pixel votes for its
 * hue, weighted by how vivid it is (saturated, neither near black nor blown
 * out). The winning hue band's average colour is the picture's colour; the
 * same is done for its left and right halves, so the glow on each side follows
 * that side of the picture. Colours are then lifted into a range that glows on
 * the dark page. A greyish picture gives a soft, nearly neutral glow.
 *
 * `colourFromPixels` is pure (tested in picture-colour.test.ts);
 * `pictureColours` reads a loaded <img> in the browser, once per address.
 */

export type PictureColours = { main: string; left: string; right: string };

type Rgb = { r: number; g: number; b: number };

const BINS = 24; // 15° of hue each
/**
 * Skin, wood and brick share a warm band of hue and fill most founder photos,
 * so they count for less there: a warm picture still glows warm, but a violet
 * neon sign or a green jacket beside a face wins over the face.
 */
const WARM_FROM = 8, WARM_TO = 48, WARM_SHARE = 0.4;
const SAMPLE_W = 32;
const SAMPLE_H = 18;

function hue(r: number, g: number, b: number, max: number, min: number): number {
  const d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 510;
  const d = (max - min) / 255;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: hue(r, g, b, max, min), s: Math.min(1, s), l };
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const css = ({ r, g, b }: Rgb) => `rgb(${r}, ${g}, ${b})`;

/** The vivid colour of one column range of the pixels, ready to glow; null if there are no opaque pixels. */
function regionColour(data: ArrayLike<number>, width: number, height: number, x0: number, x1: number): Rgb | null {
  const bins = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let count = 0, sumR = 0, sumG = 0, sumB = 0, vivid = 0;
  for (let y = 0; y < height; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      count++; sumR += r; sumG += g; sumB += b;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const v = max / 255;
      const sat = max === 0 ? 0 : (max - min) / max;
      if (v < 0.12) continue; // near black says nothing about colour
      const h = hue(r, g, b, max, min);
      const w = sat * sat * (0.35 + v) * (h >= WARM_FROM && h <= WARM_TO ? WARM_SHARE : 1);
      if (w <= 0) continue;
      const bin = bins[Math.floor(h / (360 / BINS)) % BINS];
      bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
      vivid += w;
    }
  }
  if (count === 0) return null;
  const average = { r: sumR / count, g: sumG / count, b: sumB / count };
  // Hardly any colour (a grey, black or white picture): a soft neutral glow in its own slight tint.
  if (vivid < count * 0.03) {
    const { h, s } = toHsl(average);
    return fromHsl(h, Math.min(s, 0.12), 0.62);
  }
  // The strongest hue band, counting half of each neighbour so a hue split across two bands still wins.
  let best = 0, bestScore = -1;
  for (let k = 0; k < BINS; k++) {
    const score = bins[k].w + 0.5 * (bins[(k + BINS - 1) % BINS].w + bins[(k + 1) % BINS].w);
    if (score > bestScore) { bestScore = score; best = k; }
  }
  let w = 0, r = 0, g = 0, b = 0;
  for (const [k, share] of [[best, 1], [(best + BINS - 1) % BINS, 0.5], [(best + 1) % BINS, 0.5]] as const) {
    w += bins[k].w * share; r += bins[k].r * share; g += bins[k].g * share; b += bins[k].b * share;
  }
  const { h, s, l } = toHsl({ r: r / w, g: g / w, b: b / w });
  // Bright and saturated enough to read as a glow on the dark page, in the picture's own hue.
  return fromHsl(h, clamp(s * 1.15, 0.55, 0.95), clamp(l, 0.5, 0.64));
}

/** The picture's colour, and its left and right halves', from RGBA pixels (row by row, 4 bytes each). */
export function colourFromPixels(data: ArrayLike<number>, width: number, height: number): PictureColours | null {
  const main = regionColour(data, width, height, 0, width);
  if (!main) return null;
  const half = Math.floor(width / 2);
  const left = regionColour(data, width, height, 0, half) ?? main;
  const right = regionColour(data, width, height, half, width) ?? main;
  return { main: css(main), left: css(left), right: css(right) };
}

/**
 * The part of a picture a 16:9 box shows with object-fit: cover, centred: only
 * what the viewer can see should colour the glow (a tall founder photo's sky,
 * cropped away on the card, must not).
 */
export function coverCrop(width: number, height: number, aspect = SAMPLE_W / SAMPLE_H): { sx: number; sy: number; sw: number; sh: number } {
  if (!(width > 0 && height > 0)) return { sx: 0, sy: 0, sw: width, sh: height };
  if (width / height > aspect) {
    const sw = height * aspect;
    return { sx: (width - sw) / 2, sy: 0, sw, sh: height };
  }
  const sh = width / aspect;
  return { sx: 0, sy: (height - sh) / 2, sw: width, sh };
}

function read(image: HTMLImageElement): PictureColours | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const { sx, sy, sw, sh } = coverCrop(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, SAMPLE_W, SAMPLE_H);
  // Throws for another site's picture that hasn't allowed reading (a "tainted" canvas).
  return colourFromPixels(context.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data, SAMPLE_W, SAMPLE_H);
}

function sample(image: HTMLImageElement, src: string): Promise<PictureColours | null> {
  try {
    return Promise.resolve(read(image));
  } catch {
    // Another site's picture: ask it for a readable copy (YouTube's thumbnails
    // and Supabase storage allow this). A site that refuses keeps the startup's colour.
    return new Promise((resolve) => {
      const copy = new Image();
      copy.crossOrigin = "anonymous";
      copy.decoding = "async";
      copy.onload = () => { try { resolve(read(copy)); } catch { resolve(null); } };
      copy.onerror = () => resolve(null);
      copy.src = src;
    });
  }
}

const known = new Map<string, Promise<PictureColours | null>>();

/** A loaded picture's glow colours, worked out once per address. */
export function pictureColours(image: HTMLImageElement, src: string): Promise<PictureColours | null> {
  let colours = known.get(src);
  if (!colours) {
    colours = sample(image, src);
    known.set(src, colours);
  }
  return colours;
}
