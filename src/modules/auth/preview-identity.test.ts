import { describe, expect, it } from "vitest";
import { previewIdentity } from "./preview-identity";

const personas = JSON.stringify({ member: "11111111-1111-4111-8111-111111111111", owner: "22222222-2222-4222-8222-222222222222" });

describe("the local preview identity", () => {
  it("does nothing outside next dev, whatever the settings say", () => {
    for (const NODE_ENV of ["production", "test", undefined]) {
      expect(previewIdentity("owner", { NODE_ENV, MITRA_PREVIEW_PERSONAS: personas })).toBeUndefined();
    }
  });

  it("does nothing in development unless the preview names its fictional accounts", () => {
    expect(previewIdentity("owner", { NODE_ENV: "development" })).toBeUndefined();
    expect(previewIdentity("owner", { NODE_ENV: "development", MITRA_PREVIEW_PERSONAS: "not json" })).toBeUndefined();
    expect(previewIdentity("owner", { NODE_ENV: "development", MITRA_PREVIEW_PERSONAS: JSON.stringify({ owner: "not-a-uuid" }) })).toBeUndefined();
  });

  it("picks a persona by cookie in a preview, the member by default, or a visitor", () => {
    const env = { NODE_ENV: "development", MITRA_PREVIEW_PERSONAS: personas };
    expect(previewIdentity(undefined, env)?.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(previewIdentity("owner", env)?.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(previewIdentity("visitor", env)).toBeNull();
    expect(previewIdentity("stranger", env)).toBeUndefined();
  });
});
