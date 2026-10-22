import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { beginMediaUpload, uploadedImagePath } from "./media";

const saved = { ...process.env };
beforeEach(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co"; process.env.SUPABASE_SECRET_KEY = "test"; });
afterEach(() => { process.env = { ...saved }; });

const user = "6b64e355-844f-4bf4-88ba-9781bd5bdc66", upload = "0b1c2d3e-4f50-4617-8a9b-0c1d2e3f4a5b";

describe("founders' uploaded images (2026-10-22)", () => {
  it("are recognised only at the address Mitra gave them", () => {
    expect(uploadedImagePath(`https://project.supabase.co/storage/v1/object/public/startup-media/${user}/${upload}.webp`)).toBe(`${user}/${upload}.webp`);
    for (const url of [
      `https://other.supabase.co/storage/v1/object/public/startup-media/${user}/${upload}.webp`,
      `https://project.supabase.co/storage/v1/object/public/startup-media/${user}/../${upload}.webp`,
      `https://project.supabase.co/storage/v1/object/public/startup-media/${user}/${upload}.mp4`,
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", null, undefined, "",
    ]) expect(uploadedImagePath(url), String(url)).toBeNull();
  });

  it("never include videos, which are YouTube links", async () => {
    await expect(beginMediaUpload({} as never, user, { kind: "video", contentType: "video/mp4", bytes: 1000 })).rejects.toMatchObject({ code: "INVALID_FILE" });
  });
});
