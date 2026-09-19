import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { approveDraft, createGoalDraft } from "@/modules/goals/service";
import { EvidenceError, MAX_STATEMENT_LENGTH } from "./policy";
import { listPublished, submitFile, submitLink } from "./service";
import { loadForReview, publishEvidence, rejectEvidence } from "./review";

const { profiles, evidence } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-09-19T12:00:00Z"), clock = () => now;
let owner: string, subject: string, stranger: string, marketId: string;

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

function fakeStorage() {
  const originals = new Map<string, Uint8Array>();
  return {
    originals,
    putOriginal: vi.fn(async (path: string, body: Uint8Array) => { originals.set(path, body); }),
    discardOrphan: vi.fn(async (path: string) => { originals.delete(path); }),
  };
}

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles CASCADE`);
  owner = await account("owner");
  subject = await account("subject");
  stranger = await account("stranger");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
  const draft = await createGoalDraft(db, subject, { type: "club", club: "Chess Club", deadline: "2026-10-01" }, now);
  await approveDraft(db, owner, draft.id, 5000, "Private approval note", now);
  marketId = draft.id;
});

afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}

async function sendDocument(storage: ReturnType<typeof fakeStorage>) {
  return submitFile(db, subject,
    { marketId, contentType: "application/pdf", bytes: pdf.byteLength, body: pdf, caption: "Transcript" },
    storage, clock);
}

describe("loading an item for review", () => {
  it("gives the owner the original path and the goal's own terms to judge against", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    const item = await loadForReview(db, owner, id);
    expect(item).toMatchObject({ id, kind: "file", status: "submitted", submittedByHandle: "subject" });
    expect(item?.question).toContain("Chess Club");
    expect(item?.criteria).toBeTruthy();
    expect(item?.originalPath).toBe(`${marketId}/${id}/original.pdf`);
  });

  it("refuses everyone who is not the owner", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    for (const person of [subject, stranger]) {
      await expect(loadForReview(db, person, id)).rejects.toThrow(/not available/i);
    }
  });

  it("returns null for an item that does not exist", async () => {
    expect(await loadForReview(db, owner, randomUUID())).toBeNull();
  });
});

describe("publishing a document as a statement", () => {
  it("publishes the statement and nothing about the file", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);

    const result = await publishEvidence(db, owner,
      { evidenceId: id, statement: "Fall 2026 term GPA is 3.85.", note: "Registrar letterhead" }, clock);
    expect(result).toEqual({ published: true, alreadyPublished: false });

    const published = await listPublished(db, marketId);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ kind: "file", verifiedStatement: "Fall 2026 term GPA is 3.85." });

    // Nothing that could lead back to the document.
    const visible = JSON.stringify(published);
    expect(visible).not.toContain("original");
    expect(visible).not.toContain(".pdf");
    expect(visible).not.toContain("Registrar letterhead");
  });

  it("refuses to publish a document without a statement, so nothing is ever published bare", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    for (const statement of [undefined, null, "", "  ", "ab", 42, {}]) {
      await expect(publishEvidence(db, owner, { evidenceId: id, statement }, clock))
        .rejects.toThrow(EvidenceError);
    }
    const [row] = await db.select().from(evidence).where(eq(evidence.id, id));
    expect(row.status).toBe("submitted");
    expect(await listPublished(db, marketId)).toEqual([]);
  });

  it("refuses a statement longer than the limit", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await expect(publishEvidence(db, owner, { evidenceId: id, statement: "x".repeat(MAX_STATEMENT_LENGTH + 1) }, clock))
      .rejects.toThrow(/under/i);
  });

  it("records who reviewed it and when", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await publishEvidence(db, owner, { evidenceId: id, statement: "Club membership confirmed." }, clock);
    const [row] = await db.select().from(evidence).where(eq(evidence.id, id));
    expect(row).toMatchObject({ status: "published", reviewedBy: owner, reviewedAt: now });
  });

  it("keeps the owner's private note out of the public view", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await publishEvidence(db, owner,
      { evidenceId: id, statement: "Club membership confirmed.", note: "Checked with the club secretary" }, clock);
    expect(JSON.stringify(await listPublished(db, marketId))).not.toContain("club secretary");
  });

  it("is safe to run twice", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await publishEvidence(db, owner, { evidenceId: id, statement: "First statement." }, clock);
    const again = await publishEvidence(db, owner, { evidenceId: id, statement: "Different wording." }, clock);
    expect(again).toEqual({ published: true, alreadyPublished: true });

    // The original statement stands; a retry does not rewrite what is public.
    const published = await listPublished(db, marketId);
    expect(published[0].verifiedStatement).toBe("First statement.");
  });

  it("never touches storage at all, because no document is ever published", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    storage.putOriginal.mockClear();
    await publishEvidence(db, owner, { evidenceId: id, statement: "Confirmed." }, clock);
    expect(storage.putOriginal).not.toHaveBeenCalled();
    // The original is still exactly where it was, untouched.
    expect(storage.originals.size).toBe(1);
  });

  it("refuses to publish something already rejected", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await rejectEvidence(db, owner, { evidenceId: id, note: "Not legible" }, clock);
    await expect(publishEvidence(db, owner, { evidenceId: id, statement: "Confirmed." }, clock))
      .rejects.toThrow(/cannot be published/i);
  });

  it("refuses everyone who is not the owner", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    for (const person of [subject, stranger]) {
      await expect(publishEvidence(db, person, { evidenceId: id, statement: "Confirmed." }, clock))
        .rejects.toThrow(/not available/i);
    }
    expect(await listPublished(db, marketId)).toEqual([]);
  });

  it("refuses an item that does not exist", async () => {
    await expect(publishEvidence(db, owner, { evidenceId: randomUUID(), statement: "Confirmed." }, clock))
      .rejects.toThrow(/could not be found/i);
  });
});

describe("publishing a link", () => {
  it("publishes it as submitted, with a statement being optional", async () => {
    const { id } = await submitLink(db, subject, { marketId, url: "https://example.com/proof" }, clock);
    await publishEvidence(db, owner, { evidenceId: id }, clock);

    const published = await listPublished(db, marketId);
    expect(published[0]).toMatchObject({
      kind: "link", linkUrl: "https://example.com/proof", verifiedStatement: null,
    });
  });

  it("carries a statement alongside the link when one is given", async () => {
    const { id } = await submitLink(db, subject, { marketId, url: "https://example.com/proof" }, clock);
    await publishEvidence(db, owner, { evidenceId: id, statement: "Repo was public before the deadline." }, clock);
    const published = await listPublished(db, marketId);
    expect(published[0].verifiedStatement).toBe("Repo was public before the deadline.");
  });
});

describe("the database refuses what the code should never write", () => {
  it("will not mark an uploaded document published without a statement", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await expect(db.update(evidence)
      .set({ status: "published", reviewedBy: owner, reviewedAt: now })
      .where(eq(evidence.id, id))).rejects.toThrow();
  });

  it("will not publish anything without an attributable review", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await expect(db.update(evidence)
      .set({ status: "published", verifiedStatement: "Confirmed." })
      .where(eq(evidence.id, id))).rejects.toThrow();
  });
});

describe("rejecting", () => {
  it("records the decision and publishes nothing", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    expect(await rejectEvidence(db, owner, { evidenceId: id, note: "Wrong semester" }, clock))
      .toEqual({ rejected: true });

    const [row] = await db.select().from(evidence).where(eq(evidence.id, id));
    expect(row).toMatchObject({ status: "rejected", reviewNote: "Wrong semester", reviewedBy: owner });
    expect(await listPublished(db, marketId)).toEqual([]);
  });

  it("keeps the rejected row as part of the trail rather than deleting it", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await rejectEvidence(db, owner, { evidenceId: id }, clock);
    expect(await loadForReview(db, owner, id)).not.toBeNull();
  });

  it("is safe to run twice", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await rejectEvidence(db, owner, { evidenceId: id }, clock);
    expect(await rejectEvidence(db, owner, { evidenceId: id }, clock)).toEqual({ rejected: true });
  });

  it("refuses to withdraw a statement that is already public", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    await publishEvidence(db, owner, { evidenceId: id, statement: "Confirmed." }, clock);
    await expect(rejectEvidence(db, owner, { evidenceId: id }, clock)).rejects.toThrow(/already public/i);
  });

  it("refuses everyone who is not the owner", async () => {
    const storage = fakeStorage();
    const { id } = await sendDocument(storage);
    for (const person of [subject, stranger]) {
      await expect(rejectEvidence(db, person, { evidenceId: id }, clock)).rejects.toThrow(/not available/i);
    }
  });
});
