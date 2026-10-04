import { describe, expect, it } from "vitest";
import { CAMPUS } from "./campus";

describe("campus brand configuration", () => {
  it("keeps the parent product and launch community distinct", () => {
    expect(CAMPUS.productName).toBe("Mitra");
    expect(CAMPUS.editionName).toBe("Mitra at OSU");
    expect(CAMPUS.key).toBe("osu");
  });

  it("states the university independence boundary plainly", () => {
    expect(CAMPUS.independenceStatement).toContain("independent student-built platform");
    expect(CAMPUS.independenceStatement).toContain("not affiliated with, endorsed by, or sponsored by");
    expect(CAMPUS.independenceStatement).toContain(CAMPUS.universityName);
  });
});

