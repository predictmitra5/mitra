import { describe, expect, it } from "vitest";
import { canonicalUniversityEmail, eligibleIdentity, passwordError } from "./policy";

const verifiedUser = {
  id: "3a6f0546-6747-4b8f-b682-05ec32a12c09",
  email: "student.123@osu.edu",
  email_confirmed_at: "2026-09-16T12:00:00.000Z",
  is_anonymous: false,
};

describe("university identity policy", () => {
  it("maps the two accepted input domains to one lowercase mailbox", () => {
    expect(canonicalUniversityEmail(" Student.123@OSU.EDU ")).toBe("student.123@osu.edu");
    expect(canonicalUniversityEmail("STUDENT.123@BuckeyeMail.OSU.edu")).toBe("student.123@osu.edu");
  });

  it.each([
    "student.123@evil-osu.edu",
    "student.123@osu.edu.example.com",
    "student.123@sub.osu.edu",
    "student.123+second@osu.edu",
    "student.123@osu.edu@evil.example",
    "student.123＠osu.edu",
    "student.123@оsu.edu", // Cyrillic o, not the permitted ASCII domain.
    "student..123@osu.edu",
    "student 123@osu.edu",
    null,
  ])("rejects unapproved or ambiguous mailbox input: %s", (email) => {
    expect(canonicalUniversityEmail(email)).toBeNull();
  });

  it("requires a confirmed, non-anonymous, canonical Auth identity", () => {
    for (const user of [
      null,
      { ...verifiedUser, email_confirmed_at: undefined },
      { ...verifiedUser, is_anonymous: true },
      { ...verifiedUser, email: "student.123@buckeyemail.osu.edu" },
      { ...verifiedUser, email: "student.123@gmail.com" },
      { ...verifiedUser, email: undefined },
      { ...verifiedUser, id: "client-controlled-profile-id" },
    ]) {
      expect(eligibleIdentity(user)).toBeNull();
    }
  });

  it("extracts identity without trusting editable privilege or verification metadata", () => {
    const user = {
      ...verifiedUser,
      email: "STUDENT.123@OSU.EDU",
      user_metadata: { isOwner: true, adultConfirmed: true, email_verified: true },
    };
    expect(eligibleIdentity(user)).toEqual({ id: verifiedUser.id, email: verifiedUser.email });
    expect(eligibleIdentity({ ...user, email_confirmed_at: undefined })).toBeNull();
  });
});

describe("password validation", () => {
  it("enforces size boundaries without trimming or restricting valid password characters", () => {
    expect(passwordError(null)).toBeTruthy();
    expect(passwordError("x".repeat(11))).toBeTruthy();
    expect(passwordError("x".repeat(129))).toBeTruthy();
    expect(passwordError(" a long password ")).toBeNull();
    expect(passwordError("x".repeat(12))).toBeNull();
    expect(passwordError("x".repeat(128))).toBeNull();
  });
});
