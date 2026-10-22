import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { banPerson } from "@/modules/account/moderation";
import { managedStartupIds, registerStartup, saveFounderProfile } from "./creator";
import { claimInvite, createInvite, hashJoinPassword, inviteCodeHash, joinPasswordMatches, listInvites, readInvite, revokeInvite } from "./invites";

const { startupInvites, startupFounders } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-22T16:00:00Z");
let ceo: string, cofounder: string, stranger: string, startupId: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles, startups, founders CASCADE`);
  ceo = await account("ravi");
  cofounder = await account("maya");
  stranger = await account("sam");
  await saveFounderProfile(db, ceo, founder("ravi"), now);
  startupId = (await registerStartup(db, ceo, {
    name: "Pixel Harbor", tagline: "Cozy fishing game", headline: "Games without timers", description: "A cozy pixel-art fishing game for phones with no ads and no timers at all.",
    industry: "gaming", stage: "Seed", productDetails: "You fish, you build a harbor, nothing is urgent.",
  }, now)).id;
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}

function founder(handle: string) {
  return { handle, name: `Founder ${handle}`, headline: "Building calm games", bio: "I make games where nothing is urgent, for phones.", location: "Columbus, Ohio", educationLevel: "Bachelor's" };
}

const invite = (password = "harbor-lights-42") => createInvite(db, ceo, startupId, { role: "Co-founder / CTO", password }, now);
const later = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

describe("join passwords and link codes", () => {
  it("are stored only as hashes", async () => {
    const made = await invite("harbor-lights-42");
    const [row] = await db.select().from(startupInvites).where(eq(startupInvites.id, made.id));
    expect(made.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row.tokenHash).toBe(inviteCodeHash(made.code));
    expect(row.tokenHash).not.toContain(made.code);
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain("harbor-lights-42");
  });

  it("match only the right password, with a fresh salt each time", async () => {
    const one = await hashJoinPassword("harbor-lights-42"), two = await hashJoinPassword("harbor-lights-42");
    expect(one).not.toBe(two);
    expect(await joinPasswordMatches("harbor-lights-42", one)).toBe(true);
    expect(await joinPasswordMatches("harbor-lights-43", one)).toBe(false);
    expect(await joinPasswordMatches("harbor-lights-42", "md5$nope")).toBe(false);
  });
});

describe("making invites", () => {
  it("is only for the startup's team, with a role and a long enough password", async () => {
    await expect(createInvite(db, stranger, startupId, { role: "CTO", password: "harbor-lights-42" }, now)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await expect(createInvite(db, ceo, startupId, { role: "", password: "harbor-lights-42" }, now)).rejects.toMatchObject({ field: "role" });
    await expect(createInvite(db, ceo, startupId, { role: "CTO", password: "short" }, now)).rejects.toMatchObject({ field: "password" });
  });

  it("allows five waiting at once", async () => {
    for (let n = 0; n < 5; n += 1) await invite();
    await expect(invite()).rejects.toMatchObject({ code: "LIMIT" });
  });
});

describe("joining with an invite", () => {
  it("shows who asked, and nothing for a made-up link", async () => {
    const made = await invite();
    expect(await readInvite(db, made.code, null, now)).toMatchObject({ startupName: "Pixel Harbor", inviterName: "Founder ravi", role: "Co-founder / CTO", state: "waiting" });
    expect(await readInvite(db, "x".repeat(43), null, now)).toBeNull();
    expect(await readInvite(db, "../etc", null, now)).toBeNull();
  });

  it("joins a co-founder who already has a founder profile when the password matches", async () => {
    await saveFounderProfile(db, cofounder, founder("maya"), now);
    const made = await invite();
    expect(await claimInvite(db, cofounder, made.code, "harbor-lights-42", now)).toMatchObject({ kind: "joined", startupId });
    expect(await managedStartupIds(db, cofounder)).toContain(startupId);
    const team = await db.select().from(startupFounders).where(eq(startupFounders.startupId, startupId));
    expect(team.map((t) => t.role).sort()).toEqual(["Co-founder / CTO", "Founder"]);
    expect((await readInvite(db, made.code, cofounder, now))?.state).toBe("joined");
    expect((await readInvite(db, made.code, stranger, now))?.state).toBe("joined");
  });

  it("holds the place for someone without a founder profile until they make one", async () => {
    const made = await invite();
    expect(await claimInvite(db, cofounder, made.code, "harbor-lights-42", now)).toMatchObject({ kind: "needs_profile" });
    expect(await managedStartupIds(db, cofounder)).not.toContain(startupId);
    expect((await readInvite(db, made.code, cofounder, now))?.state).toBe("unlocked");
    expect((await readInvite(db, made.code, stranger, now))?.state).toBe("used");
    await expect(claimInvite(db, stranger, made.code, "harbor-lights-42", now)).rejects.toMatchObject({ code: "USED" });
    await saveFounderProfile(db, cofounder, founder("maya"), later(1));
    expect(await managedStartupIds(db, cofounder)).toContain(startupId);
  });

  it("counts wrong passwords and locks after five", async () => {
    const made = await invite();
    for (let n = 1; n <= 4; n += 1) {
      await expect(claimInvite(db, cofounder, made.code, "wrong-password", now)).rejects.toMatchObject({ code: "WRONG_PASSWORD", message: expect.stringContaining(`${5 - n} `) });
    }
    await expect(claimInvite(db, cofounder, made.code, "wrong-password", now)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(claimInvite(db, cofounder, made.code, "harbor-lights-42", now)).rejects.toMatchObject({ code: "LOCKED" });
    expect((await readInvite(db, made.code, cofounder, now))?.state).toBe("locked");
  });

  it("stops working after a week, or once cancelled", async () => {
    const old = await invite();
    await expect(claimInvite(db, cofounder, old.code, "harbor-lights-42", later(7 * 24 + 1))).rejects.toMatchObject({ code: "EXPIRED" });
    const cancelled = await invite();
    await expect(revokeInvite(db, stranger, cancelled.id, now)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await revokeInvite(db, ceo, cancelled.id, now);
    await expect(claimInvite(db, cofounder, cancelled.code, "harbor-lights-42", now)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listInvites(db, ceo, startupId, now)).map((i) => i.state).sort()).toEqual(["cancelled", "waiting"]);
    expect(await listInvites(db, stranger, startupId, now)).toEqual([]);
  });

  it("can't be used by the founder who made it", async () => {
    const made = await invite();
    await expect(claimInvite(db, ceo, made.code, "harbor-lights-42", now)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    const [row] = await db.select().from(startupInvites).where(and(eq(startupInvites.id, made.id)));
    expect(row.claimedBy).toBeNull();
  });

  it("stop working when the founder who made them is banned", async () => {
    const owner = await account("owner_acct");
    await db.update(schema.profiles).set({ isOwner: 1 }).where(eq(schema.profiles.id, owner));
    const made = await invite();
    await banPerson(db, owner, ceo, "Testing a ban.", () => now);
    await expect(claimInvite(db, cofounder, made.code, "harbor-lights-42", now)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
