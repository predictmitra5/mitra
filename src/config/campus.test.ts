import { describe, expect, it } from "vitest";
import { CAMPUSES, campusForKey, canonicalUniversityEmail, universityEmail } from "./campus";

describe("campus brand configuration", () => {
  it("defines distinct OSU and UIUC editions under the Mitra parent brand", () => {
    expect(CAMPUSES.osu.productName).toBe("Mitra");
    expect(CAMPUSES.osu.editionName).toBe("Mitra at OSU");
    expect(CAMPUSES.uiuc.editionName).toBe("Mitra at UIUC");
    expect(campusForKey("unknown")).toBe(CAMPUSES.osu);
  });

  it("states each independence boundary without a build-origin claim", () => {
    for (const campus of Object.values(CAMPUSES)) {
      expect(campus.independenceStatement).toContain("Mitra is an independent platform");
      expect(campus.independenceStatement).toContain("not affiliated with, endorsed by, or sponsored by");
      expect(campus.independenceStatement).not.toContain("built by");
    }
  });

  it("derives campus and canonical email only from exact approved domains", () => {
    expect(universityEmail("Student.123@BuckeyeMail.OSU.edu")).toEqual({ email: "student.123@osu.edu", campus: "osu" });
    expect(universityEmail("NETID@ILLINOIS.EDU")).toEqual({ email: "netid@illinois.edu", campus: "uiuc" });
    expect(canonicalUniversityEmail("netid@illinois.edu", "osu")).toBeNull();
    expect(canonicalUniversityEmail("name@illinois.edu.evil.example")).toBeNull();
  });
});
