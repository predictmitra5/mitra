// Turns downloaded demo thumbnails into what the app serves (DECISIONS.md
// 2026-11-15, "Thumbnails generated with Higgsfield"): every <file>.png or
// <file>.jpg in the folder given becomes public/demo/thumbnails/<file>.webp,
// 1280 by 720, cropped to 16:9 from the centre if it is not already.
//
//   node scripts/demo-thumbnails/convert.mjs <folder of downloads>
//
// Then add each file name to READY in src/modules/startups/demo/thumbnails.ts;
// thumbnails.test.ts checks the list against the folder.

import { mkdirSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/demo-thumbnails/convert.mjs <folder of downloads>");
  process.exit(1);
}
const target = join(process.cwd(), "public", "demo", "thumbnails");
mkdirSync(target, { recursive: true });

for (const name of readdirSync(source).sort()) {
  if (![".png", ".jpg", ".jpeg"].includes(extname(name).toLowerCase())) continue;
  const file = basename(name, extname(name));
  const out = join(target, `${file}.webp`);
  const info = await sharp(join(source, name))
    .resize(1280, 720, { fit: "cover", position: "centre" })
    .webp({ quality: 82, effort: 6 })
    .toFile(out);
  console.log(`${file}.webp  ${Math.round(info.size / 1024)} KB`);
}
