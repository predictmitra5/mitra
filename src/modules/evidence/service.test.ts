import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { approveDraft, createGoalDraft } from "@/modules/goals/service";
import { EvidenceError } from "./policy";
import { canSubmit, listForOwner, listForSubject, listPublished, submitFile, submitLink } from "./service";

const { profiles, markets, evidence } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-09-19T12:00:00Z"), clock = () => now;
let owner: string, subject: string, stranger: string, marketId: string;

/** Stands in for Supabase Storage; records what would have been written. */
function fakeStorage() {
  const written = new Map<string, { body: Uint8Array; contentType: string }>();
  const discarded: string[] = [];
  return {
    written, discarded,
    putOriginal: vi.fn(async (path: string, body: Uint8Array, contentType: string) => {
      if (written.has(path)) throw new Error("refusing to overwrite an existing object");
      written.set(path, { body, contentType });
    }),
    discardOrphan: vi.fn(async (path: string) => { written.delete(path); discarded.push(path); }),
  };
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

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
  marketId = await openGoal();
});

afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}

async function openGoal() {
  const draft = await createGoalDraft(db, subject, { type: "club", club: "Chess Club", deadline: "2026-10-01" }, now);
  await approveDraft(db, owner, draft.id, 5000, "Private approval note", now);
  return draft.id;
}

describe("attaching a link", () => {
  it("stores it for the subject and tells the owner who sent it", async () => {
    const { id } = await submitLink(db, subject, { marketId, url: "https://github.com/me/project", caption: "The repo" }, clock);
    const forOwner = await listForOwner(db, owner, marketId);
    expect(forOwner).toHaveLength(1);
    expect(forOwner[0]).toMatchObject({
      id, kind: "link", linkUrl: "https://github.com/me/project", caption: "The repo",
      status: "submitted", submittedByHandle: "subject", originalPath: null,
    });
  });

  it("refuses anyone other than the subject", async () => {
    for (const person of [stranger, owner]) {
      await expect(submitLink(db, person, { marketId, url: "https://example.com/x" }, clock))
        .rejects.toThrow(EvidenceError);
    }
    expect(await listForOwner(db, owner, marketId)).toHaveLength(0);
  });

  it("refuses a dangerous address and writes nothing", async () => {
    await expect(submitLink(db, subject, { marketId, url: "javascript:alert(1)" }, clock)).rejects.toThrow();
    expect(await listForOwner(db, owner, marketId)).toHaveLength(0);
  });

  it("refuses once the proof deadline has passed", async () => {
    const late = new Date("2026-11-01T12:00:00Z");
    await expect(submitLink(db, subject, { marketId, url: "https://example.com/x" }, () => late))
      .rejects.toThrow(/deadline/i);
  });
});

describe("attaching a file", () => {
  it("stores the object and a row pointing at it", async () => {
    const storage = fakeStorage();
    const { id } = await submitFile(db, subject,
      { marketId, contentType: "image/png", bytes: png.byteLength, body: png, caption: "My transcript" },
      storage, clock);

    expect(storage.putOriginal).toHaveBeenCalledOnce();
    const [row] = await listForOwner(db, owner, marketId);
    expect(row).toMatchObject({ id, kind: "file", caption: "My transcript", status: "submitted", linkUrl: null });
    expect(row.originalPath).toBe(`${marketId}/${id}/original.png`);
    expect(storage.written.has(row.originalPath!)).toBe(true);
  });

  it("never writes to storage for someone who is not the subject", async () => {
    const storage = fakeStorage();
    await expect(submitFile(db, stranger,
      { marketId, contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock))
      .rejects.toThrow(/only the person/i);
    expect(storage.putOriginal).not.toHaveBeenCalled();
    expect(storage.written.size).toBe(0);
  });

  it("never writes to storage for a goal that does not exist", async () => {
    const storage = fakeStorage();
    await expect(submitFile(db, subject,
      { marketId: randomUUID(), contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock))
      .rejects.toThrow(/could not be found/i);
    expect(storage.putOriginal).not.toHaveBeenCalled();
  });

  it("refuses a type it cannot read, before touching storage", async () => {
    const storage = fakeStorage();
    for (const contentType of ["image/svg+xml", "image/gif", "text/html", "application/zip"]) {
      await expect(submitFile(db, subject,
        { marketId, contentType, bytes: png.byteLength, body: png }, storage, clock))
        .rejects.toThrow(/PDF, or a PNG, JPEG or WebP/);
    }
    expect(storage.putOriginal).not.toHaveBeenCalled();
  });

  it("accepts a PDF, since the app only reads it and never republishes it", async () => {
    const storage = fakeStorage();
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const { id } = await submitFile(db, subject,
      { marketId, contentType: "application/pdf", bytes: pdf.byteLength, body: pdf }, storage, clock);
    const [row] = await listForOwner(db, owner, marketId);
    expect(row.originalPath).toBe(`${marketId}/${id}/original.pdf`);
  });

  it("refuses a body whose real size does not match the declared one", async () => {
    const storage = fakeStorage();
    await expect(submitFile(db, subject,
      { marketId, contentType: "image/png", bytes: 5, body: png }, storage, clock))
      .rejects.toThrow(/could not be read/i);
    expect(storage.putOriginal).not.toHaveBeenCalled();
  });

  it("discards the stored object when the row cannot be written", async () => {
    const storage = fakeStorage();
    // Withdraw the subject after the pre-check but before the transaction.
    const original = storage.putOriginal;
    storage.putOriginal = vi.fn(async (path: string, body: Uint8Array, contentType: string) => {
      await original(path, body, contentType);
      await db.update(profiles).set({ withdrawnAt: now }).where(eq(profiles.id, subject));
    });

    await expect(submitFile(db, subject,
      { marketId, contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock))
      .rejects.toThrow(EvidenceError);

    expect(storage.discarded).toHaveLength(1);
    expect(storage.written.size).toBe(0);
    expect(await listForOwner(db, owner, marketId)).toHaveLength(0);
  });

  it("gives each submission its own path, so one cannot overwrite another", async () => {
    const storage = fakeStorage();
    const first = await submitFile(db, subject, { marketId, contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock);
    const second = await submitFile(db, subject, { marketId, contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock);
    expect(first.id).not.toBe(second.id);
    expect(storage.written.size).toBe(2);
  });

  it("enforces the cap on how many pieces one goal can carry", async () => {
    const storage = fakeStorage();
    for (let i = 0; i < 10; i += 1) {
      await submitLink(db, subject, { marketId, url: `https://example.com/${i}` }, clock);
    }
    await expect(submitFile(db, subject,
      { marketId, contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock))
      .rejects.toThrow(/at most/i);
    expect(storage.putOriginal).not.toHaveBeenCalled();
  });
});

describe("who can read what", () => {
  beforeEach(async () => {
    await submitLink(db, subject, { marketId, url: "https://example.com/proof", caption: "Evidence" }, clock);
  });

  it("shows nothing publicly until the owner approves it", async () => {
    expect(await listPublished(db, marketId)).toEqual([]);
  });

  it("refuses the owner's view to everyone who is not the owner", async () => {
    for (const person of [subject, stranger]) {
      await expect(listForOwner(db, person, marketId)).rejects.toThrow(/not available/i);
    }
  });

  it("keeps the owner's private review note out of the subject's view", async () => {
    const [row] = await listForOwner(db, owner, marketId);
    await db.update(evidence).set({ reviewNote: "Checked against the registrar" }).where(eq(evidence.id, row.id));

    const mine = await listForSubject(db, subject, marketId);
    expect(mine).toHaveLength(1);
    expect(JSON.stringify(mine)).not.toContain("registrar");
    expect(Object.keys(mine[0])).not.toContain("reviewNote");
  });

  it("shows a subject only their own submissions", async () => {
    expect(await listForSubject(db, stranger, marketId)).toEqual([]);
  });

  it("publishes the statement and never anything that leads back to the document", async () => {
    const storage = fakeStorage();
    const { id } = await submitFile(db, subject,
      { marketId, contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock);
    await db.update(evidence).set({
      status: "published", verifiedStatement: "Fall 2026 GPA is 3.85.", reviewedBy: owner, reviewedAt: now,
    }).where(eq(evidence.id, id));

    const published = await listPublished(db, marketId);
    expect(published).toHaveLength(1);
    expect(published[0].verifiedStatement).toBe("Fall 2026 GPA is 3.85.");

    const visible = JSON.stringify(published);
    expect(visible).not.toContain("original");
    expect(visible).not.toContain(".png");
    expect(visible).not.toContain(marketId + "/" + id);
  });
});

describe("database guarantees", () => {
  it("refuses to mark an uploaded document published without a statement", async () => {
    const storage = fakeStorage();
    const { id } = await submitFile(db, subject,
      { marketId, contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock);
    await expect(db.update(evidence)
      .set({ status: "published", reviewedBy: owner, reviewedAt: now })
      .where(eq(evidence.id, id))).rejects.toThrow();
  });

  it("refuses to publish anything without an attributable review", async () => {
    await submitLink(db, subject, { marketId, url: "https://example.com/x" }, clock);
    await expect(db.update(evidence).set({ status: "published" })).rejects.toThrow();
  });

  it("has no column that could point the public at a stored file", async () => {
    // The published path column was removed with the redaction design, so there
    // is no longer any field on a public row that names an object in storage.
    const storage = fakeStorage();
    const { id } = await submitFile(db, subject,
      { marketId, contentType: "image/png", bytes: png.byteLength, body: png }, storage, clock);
    await db.update(evidence).set({
      status: "published", verifiedStatement: "Confirmed.", reviewedBy: owner, reviewedAt: now,
    }).where(eq(evidence.id, id));

    const [row] = await listPublished(db, marketId);
    for (const value of Object.values(row)) {
      if (typeof value === "string") expect(value).not.toContain(marketId + "/");
    }
  });

  it("refuses a row that is both a file and a link", async () => {
    await expect(db.insert(evidence).values({
      marketId, submittedBy: subject, kind: "link",
      linkUrl: "https://example.com/x", originalPath: "somewhere/original.png",
    })).rejects.toThrow();
  });
});

describe("canSubmit", () => {
  it("is true only for the subject inside the window", async () => {
    expect(await canSubmit(db, subject, marketId, clock)).toBe(true);
    expect(await canSubmit(db, stranger, marketId, clock)).toBe(false);
    expect(await canSubmit(db, owner, marketId, clock)).toBe(false);
    expect(await canSubmit(db, subject, marketId, () => new Date("2026-11-01T12:00:00Z"))).toBe(false);
  });

  it("is false for a goal that does not exist, without throwing", async () => {
    expect(await canSubmit(db, subject, randomUUID(), clock)).toBe(false);
  });

  it("stays true after trading closes, through the proof window", async () => {
    await db.update(markets).set({ status: "closed", tradingClosedAt: now }).where(eq(markets.id, marketId));
    expect(await canSubmit(db, subject, marketId, clock)).toBe(true);
  });
});
