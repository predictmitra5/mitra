import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The arrow (U+2197) has an emoji form, and Windows draws it as a blue tile
// unless the text-presentation selector (U+FE0E) follows it. CSS alone did not
// prevent that, so every arrow in the interface carries the selector.
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx$/.test(entry.name) ? [path] : [];
  });
}

describe("interface glyphs", () => {
  it("marks every arrow for its text form, not the emoji tile", () => {
    const bare = sources(join(process.cwd(), "src/app")).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return /↗(?!︎)|&#8599;(?!&#65038;)/.test(text) ? [file] : [];
    });
    expect(bare).toEqual([]);
  });
});
