import { readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { colourFromPixels, coverCrop } from "./picture-colour";

const W = 32, H = 18;

/** RGBA pixels filled by a function of x and y. */
function picture(fill: (x: number, y: number) => [number, number, number, number?]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b, a = 255] = fill(x, y);
    data.set([r, g, b, a], (y * W + x) * 4);
  }
  return data;
}

function parse(colour: string): { h: number; s: number; l: number } {
  const [r, g, b] = colour.match(/\d+/g)!.map(Number);
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    const [rr, gg, bb] = [r / 255, g / 255, b / 255];
    h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}
const near = (a: number, b: number, within: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) <= within;

describe("a picture's glow colours", () => {
  it("takes a plain picture's own hue, bright enough to glow", () => {
    const blue = colourFromPixels(picture(() => [20, 70, 160]), W, H)!;
    const { h, s, l } = parse(blue.main);
    expect(near(h, 221, 4)).toBe(true);
    expect(s).toBeGreaterThan(0.5);
    expect(l).toBeGreaterThanOrEqual(0.49);
    expect(l).toBeLessThanOrEqual(0.65);
    expect(blue.left).toBe(blue.main);
    expect(blue.right).toBe(blue.main);
  });

  it("follows each half of the picture on its own side", () => {
    const split = colourFromPixels(picture((x) => (x < W / 2 ? [200, 30, 40] : [30, 180, 70])), W, H)!;
    expect(near(parse(split.left).h, 356, 6)).toBe(true);
    expect(near(parse(split.right).h, 137, 6)).toBe(true);
  });

  it("lets a vivid colour win over a larger dull or dark area", () => {
    // Mostly near-black and grey with an orange third: the glow is orange, not grey.
    const lamp = colourFromPixels(picture((x) => (x < 11 ? [235, 140, 40] : x < 22 ? [12, 12, 14] : [120, 120, 122])), W, H)!;
    const { h, s } = parse(lamp.main);
    expect(near(h, 31, 8)).toBe(true);
    expect(s).toBeGreaterThan(0.5);
  });

  it("lets a smaller accent colour win over skin tones, which count for less", () => {
    // Two thirds a face-like warm tone, one third violet neon: the glow is violet.
    const face = colourFromPixels(picture((x) => (x < 21 ? [200, 140, 100] : [130, 60, 225])), W, H)!;
    expect(near(parse(face.main).h, 265, 8)).toBe(true);
  });

  it("gives a greyish picture a soft, nearly neutral glow", () => {
    const grey = colourFromPixels(picture((x, y) => [110 + ((x + y) % 3), 112, 115]), W, H)!;
    expect(parse(grey.main).s).toBeLessThanOrEqual(0.13);
  });

  it("ignores see-through pixels and returns nothing for an empty picture", () => {
    expect(colourFromPixels(picture(() => [255, 0, 0, 0]), W, H)).toBeNull();
    const half = colourFromPixels(picture((x) => (x < W / 2 ? [255, 0, 0, 0] : [40, 160, 90])), W, H)!;
    expect(half.left).toBe(half.main); // nothing opaque on the left: it borrows the whole picture's colour
    expect(near(parse(half.main).h, 145, 6)).toBe(true);
  });

  it("reads only the part a 16:9 card shows", () => {
    expect(coverCrop(1280, 720)).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 });
    // A square photo: the middle band; a tall one: a thinner middle band; a very wide one: the middle columns.
    const square = coverCrop(900, 900);
    expect([square.sx, square.sw]).toEqual([0, 900]);
    expect(square.sh).toBeCloseTo(506.25);
    expect(square.sy).toBeCloseTo(196.875);
    const tall = coverCrop(600, 800);
    expect(tall.sw).toBe(600);
    expect(tall.sh).toBeCloseTo(337.5);
    expect(tall.sy).toBeCloseTo(231.25);
    const wide = coverCrop(2100, 600);
    expect(wide.sh).toBe(600);
    expect(wide.sw).toBeCloseTo(1066.67, 1);
    expect(wide.sx).toBeCloseTo(516.67, 1);
    // A 4:3 YouTube thumbnail: its letterbox bars fall outside.
    const youtube = coverCrop(480, 360);
    expect(youtube.sh).toBeCloseTo(270);
    expect(youtube.sy).toBeCloseTo(45);
    expect(coverCrop(0, 0)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });

  it("gives every demo thumbnail a vivid colour", async () => {
    const folder = join(process.cwd(), "public", "demo", "thumbnails");
    for (const file of readdirSync(folder).filter((f) => f.endsWith(".webp"))) {
      const { data, info } = await sharp(join(folder, file)).resize(W, H, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const colours = colourFromPixels(data, info.width, info.height);
      expect(colours, file).not.toBeNull();
      for (const c of Object.values(colours!)) expect(parse(c).l, `${file} ${c}`).toBeGreaterThanOrEqual(0.49);
    }
  });
});
