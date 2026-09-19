import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_TYPES,
  EvidenceError,
  MAX_CAPTION_LENGTH,
  MAX_FILE_BYTES,
  MAX_ITEMS_PER_GOAL,
  assertAcceptableFile,
  assertMaySubmit,
  normalizeCaption,
  normalizeLink,
  originalStoragePath,
  proofWindowOpen,
  publishedStoragePath,
  type EvidenceMarket,
} from "./policy";

const now = new Date("2026-09-19T12:00:00.000Z");
const subject = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const marketId = "33333333-3333-4333-8333-333333333333";
const evidenceId = "44444444-4444-4444-8444-444444444444";

function market(overrides: Partial<EvidenceMarket> = {}): EvidenceMarket {
  return {
    subjectUserId: subject,
    status: "closed",
    approvedAt: new Date("2026-08-01T12:00:00.000Z"),
    evidenceDeadlineAt: new Date("2026-09-26T03:59:00.000Z"),
    ...overrides,
  };
}

describe("who may attach proof", () => {
  it("accepts the subject inside the window", () => {
    expect(() => assertMaySubmit(market(), subject, 0, now)).not.toThrow();
  });

  it("refuses anyone who is not the subject, including a trader on the goal", () => {
    expect(() => assertMaySubmit(market(), stranger, 0, now)).toThrow(EvidenceError);
    try {
      assertMaySubmit(market(), stranger, 0, now);
    } catch (error) {
      expect((error as EvidenceError).code).toBe("NOT_SUBJECT");
    }
  });

  it("refuses a goal that was never approved", () => {
    expect(() => assertMaySubmit(market({ approvedAt: null, status: "draft" }), subject, 0, now))
      .toThrow(/not accepting/i);
  });

  it("refuses goals that are finished or were never live", () => {
    for (const status of ["draft", "rejected", "settled", "cancelled"]) {
      expect(() => assertMaySubmit(market({ status }), subject, 0, now)).toThrow(/not accepting/i);
    }
  });

  it("accepts while trading is open, while closed, and while a ruling is contestable", () => {
    for (const status of ["open", "closed", "ruled"]) {
      expect(() => assertMaySubmit(market({ status }), subject, 0, now)).not.toThrow();
    }
  });

  it("refuses after the proof deadline, and accepts right up to it", () => {
    const deadline = new Date("2026-09-26T03:59:00.000Z");
    expect(() => assertMaySubmit(market(), subject, 0, deadline)).not.toThrow();
    expect(() => assertMaySubmit(market(), subject, 0, new Date(deadline.getTime() + 1)))
      .toThrow(/deadline .* has passed/i);
  });

  it("caps how many pieces one goal can carry", () => {
    expect(() => assertMaySubmit(market(), subject, MAX_ITEMS_PER_GOAL - 1, now)).not.toThrow();
    expect(() => assertMaySubmit(market(), subject, MAX_ITEMS_PER_GOAL, now)).toThrow(/at most/i);
  });

  it("checks identity before anything else, so a stranger learns nothing about the goal's state", () => {
    try {
      assertMaySubmit(market({ status: "settled" }), stranger, 99, now);
    } catch (error) {
      expect((error as EvidenceError).code).toBe("NOT_SUBJECT");
    }
  });
});

describe("proofWindowOpen", () => {
  it("agrees with the submission rules", () => {
    expect(proofWindowOpen(market(), now)).toBe(true);
    expect(proofWindowOpen(market({ approvedAt: null }), now)).toBe(false);
    expect(proofWindowOpen(market({ status: "settled" }), now)).toBe(false);
    expect(proofWindowOpen(market(), new Date("2026-10-01T00:00:00.000Z"))).toBe(false);
  });
});

describe("accepted files", () => {
  it("accepts the image types this app can redact", () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(() => assertAcceptableFile(type, 1024)).not.toThrow();
    }
  });

  it("refuses anything it cannot rasterise and re-render, including PDFs", () => {
    for (const type of ["application/pdf", "image/gif", "image/svg+xml", "text/html", "", null, 42]) {
      expect(() => assertAcceptableFile(type, 1024)).toThrow(EvidenceError);
    }
  });

  it("refuses an SVG, which can carry script and external references", () => {
    expect(() => assertAcceptableFile("image/svg+xml", 1024)).toThrow(/PNG, JPEG or WebP/);
  });

  it("enforces the size limit at its boundary", () => {
    expect(() => assertAcceptableFile("image/png", MAX_FILE_BYTES)).not.toThrow();
    expect(() => assertAcceptableFile("image/png", MAX_FILE_BYTES + 1)).toThrow(/10 MB/);
  });

  it("refuses empty, negative and unreadable sizes", () => {
    for (const bytes of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "1024", null]) {
      expect(() => assertAcceptableFile("image/png", bytes)).toThrow(EvidenceError);
    }
  });
});

describe("submitted links", () => {
  it("accepts an ordinary web address and returns it normalised", () => {
    expect(normalizeLink("https://github.com/someone/project")).toBe("https://github.com/someone/project");
    expect(normalizeLink("  https://example.com/a?b=c  ")).toBe("https://example.com/a?b=c");
  });

  it("refuses schemes that are not the web", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///C:/Users/someone/transcript.png",
      "ftp://example.com/x",
    ]) {
      expect(() => normalizeLink(value)).toThrow(EvidenceError);
    }
  });

  it("refuses an address carrying credentials rather than quietly stripping them", () => {
    expect(() => normalizeLink("https://user:secret@example.com/x")).toThrow(/username and password/i);
  });

  it("refuses text that is not an address at all", () => {
    for (const value of ["", "   ", "not a link", "example", null, 7, {}]) {
      expect(() => normalizeLink(value)).toThrow(EvidenceError);
    }
  });

  it("refuses a host with no dot, which cannot be a public site", () => {
    expect(() => normalizeLink("https://localhost/proof")).toThrow(/public host/i);
  });

  it("refuses an address longer than the column allows", () => {
    expect(() => normalizeLink(`https://example.com/${"x".repeat(3000)}`)).toThrow(EvidenceError);
  });
});

describe("captions", () => {
  it("treats absent, empty and whitespace-only descriptions as none", () => {
    for (const value of [null, undefined, "", "   "]) expect(normalizeCaption(value)).toBeNull();
  });

  it("trims and keeps what was written", () => {
    expect(normalizeCaption("  my final transcript  ")).toBe("my final transcript");
  });

  it("enforces the length limit at its boundary", () => {
    expect(normalizeCaption("x".repeat(MAX_CAPTION_LENGTH))).toHaveLength(MAX_CAPTION_LENGTH);
    expect(() => normalizeCaption("x".repeat(MAX_CAPTION_LENGTH + 1))).toThrow(EvidenceError);
  });
});

describe("storage paths", () => {
  it("keys a file by goal and evidence id, never by anything the browser supplied", () => {
    const path = originalStoragePath(marketId, evidenceId, "image/png");
    expect(path).toBe(`${marketId}/${evidenceId}/original.png`);
    expect(path).not.toContain("..");
  });

  it("uses the right extension for each accepted type", () => {
    expect(originalStoragePath(marketId, evidenceId, "image/jpeg")).toMatch(/original\.jpg$/);
    expect(originalStoragePath(marketId, evidenceId, "image/webp")).toMatch(/original\.webp$/);
  });

  it("never lets the published artifact be the original", () => {
    expect(publishedStoragePath(marketId, evidenceId))
      .not.toBe(originalStoragePath(marketId, evidenceId, "image/png"));
  });

  it("always publishes as PNG, so a re-encode drops the original's metadata", () => {
    expect(publishedStoragePath(marketId, evidenceId)).toMatch(/\.png$/);
  });
});
