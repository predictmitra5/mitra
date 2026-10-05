// Local presentation check for the signed-in pages: account, new goal, your
// predictions, the owner's review queue, outcomes and people, a goal page with
// the trade ticket, and the feed as a signed-in person would see it. The real page components render against an in-memory
// PostgreSQL (PGlite) seeded with fictional people through the app's own
// services. No Supabase, no Auth users, no network, no credentials.
//
// Run after `npm run build` (the stylesheet comes from the build):
//   node scripts/preview-signed-in.mjs
// then open http://127.0.0.1:3120. Stop with Ctrl+C or "stop" on stdin.
// Add --phone to open it from a phone on the same Wi-Fi; the addresses are printed.
// Forms render but do not submit: this checks how pages look, not what they do.
// A goal page opened with ?side=yes shows the phone's trade sheet open.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";

const project = process.cwd();
const PORT = 3120;
const phoneMode = process.argv.includes("--phone");

// ------------------------------------------------------------ stand-ins
// Only what cannot run outside Next.js or would reach a real service.
const stubs = {
  "server-only": "export {};",
  "@/db/client": `import * as schema from "@/db/schema"; export { schema }; export function getDb() { return globalThis.__preview.db; }`,
  "@/modules/auth/server": `
    export async function currentIdentity() { return globalThis.__preview.identity; }
    export async function createAuthClient() { throw new Error("No Supabase in the preview."); }`,
  "@/modules/evidence/storage": `
    export const ORIGINALS_BUCKET = "evidence-originals"; export const ORIGINAL_VIEW_SECONDS = 300;
    export class StorageError extends Error {}
    const offline = async () => { throw new StorageError("No storage in the preview."); };
    export const putOriginal = offline, readOriginal = offline, discardOrphan = offline, createOriginalUploadUrl = offline;
    export async function signedOriginalUrl() { return "#fictional-original"; }`,
  "next/navigation": `
    export function redirect(to) { const e = new Error("redirect"); e.previewRedirect = to; throw e; }
    export function notFound() { const e = new Error("not found"); e.previewNotFound = true; throw e; }
    export function useRouter() { return { push() {}, replace() {}, refresh() {} }; }
    export function usePathname() { return "/"; }
    export function useSearchParams() { return globalThis.__preview.search ?? new URLSearchParams(); }`,
  "next/link": `
    import React from "react";
    export default function Link({ href, children, prefetch, ...rest }) { return React.createElement("a", { href, ...rest }, children); }`,
  "next/headers": `
    export async function cookies() { return { get() {}, getAll() { return []; }, set() {} }; }
    export async function headers() { return new Headers(); }`,
  "next/cache": "export function revalidatePath() {} export function revalidateTag() {} export function refresh() {}",
};

const entry = `
export { default as AccountPage } from "@/app/account/page";
export { default as NewGoalPage } from "@/app/goals/new/page";
export { default as PositionsPage } from "@/app/positions/page";
export { default as ReviewPage } from "@/app/review/page";
export { default as OutcomesPage } from "@/app/review/markets/page";
export { default as MarketPage } from "@/app/markets/[id]/page";
export { default as PeoplePage } from "@/app/review/people/page";
export { default as FeedPage } from "@/app/page";
export { banPerson } from "@/modules/account/moderation";
export { provisionAccount } from "@/modules/account/provision";
export { createGoalDraft, approveDraft, rejectDraft } from "@/modules/goals/service";
export { previewTrade, executeTrade } from "@/modules/market/service";
export { applyOwnerCommand } from "@/modules/market/lifecycle";
export * as schema from "@/db/schema";
`;

const output = await build({
  stdin: { contents: entry, resolveDir: project, loader: "ts" },
  bundle: true, write: false, format: "cjs", platform: "node", jsx: "automatic",
  packages: "external", logLevel: "error",
  plugins: [{ name: "preview-stubs", setup(builder) {
    // Stand-ins first, so they win over the real modules of the same name.
    const names = Object.keys(stubs).map((n) => n.replace(/[/\\^$*+?.()|[\]{}@-]/g, "\\$&"));
    builder.onResolve({ filter: new RegExp(`^(${names.join("|")})$`) }, (args) => ({ path: args.path, namespace: "stub" }));
    builder.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: stubs[args.path], resolveDir: project, loader: "js" }));
    // The app's "@/" import alias, bundled rather than left external.
    builder.onResolve({ filter: /^@\// }, (args) => builder.resolve(`./${args.path.slice(2)}`, { resolveDir: resolve(project, "src"), kind: args.kind }));
  } }],
});
const compiled = { exports: {} };
// Execute only the bundle compiled above from this repository's own sources.
new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const app = compiled.exports;

const staticDirectory = join(project, ".next/static");
const cssFiles = (await readdir(staticDirectory, { recursive: true }).catch(() => [])).filter((file) => file.endsWith(".css"));
if (!cssFiles.length) throw new Error("Run npm run build before starting the signed-in preview.");
const css = (await Promise.all(cssFiles.map((file) => readFile(join(staticDirectory, file), "utf8")))).join("\n");

// ------------------------------------------------------------ fictional data
const memory = new PGlite();
const db = drizzle(memory, { schema: app.schema });
for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
  for (const statement of migration.sql) await db.execute(sql.raw(statement));
}
globalThis.__preview = { db, identity: null };

const DAY = 86_400_000;
const now = Date.now();
const at = (days) => new Date(now + days * DAY);
const easternDate = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);

async function person(handle, displayName, photo = true) {
  const id = randomUUID();
  await app.provisionAccount(db, id, { displayName, handle, adultConfirmed: true }, at(-30));
  if (photo) await db.update(app.schema.profiles).set({ photoPath: `fixture/${handle}.webp`, photoUpdatedAt: at(-29) }).where(eq(app.schema.profiles.id, id));
  return id;
}
const people = {
  owner: await person("ava", "Ava Okafor"),
  trader: await person("leo", "Leo Park"),
  maya: await person("maya_builds", "Maya Chen"),
  jordan: await person("jordan_p", "Jordan Patel"),
  sam: await person("sam_r", "Sam Rivera"),
  priya: await person("priya_n", "Priya Nair"),
  ben: await person("ben_k", "Ben Kowalski", false),
  quinn: await person("quinn_t", "Quinn Taylor"),
  luis: await person("luis_lifts", "Luis Ortega"),
  aisha: await person("aisha_b", "Aisha Bello"),
  noor: await person("noor_h", "Noor Haddad"),
  andre: await person("andre_f", "Andre Fontaine"),
  // People who only bet, so prices have somewhere to move.
  kai: await person("kai_w", "Kai Wong"),
  rosa: await person("rosa_m", "Rosa Mendes"),
  theo: await person("theo_b", "Theo Brandt"),
  wen: await person("wen_l", "Wen Li"),
};
await db.update(app.schema.profiles).set({ isOwner: 1 }).where(eq(app.schema.profiles.id, people.owner));

async function goal(subject, input, openingBp, createdDaysAgo) {
  const clock = at(-createdDaysAgo);
  const draft = await app.createGoalDraft(db, subject, input, clock);
  if (openingBp !== null) await app.approveDraft(db, people.owner, draft.id, openingBp, "Fictional preview approval.", clock);
  return draft.id;
}
async function trade(userId, marketId, side, points, daysAgo) {
  const clock = () => at(-daysAgo);
  const preview = await app.previewTrade(db, userId, { marketId, side, action: "buy", amountMicro: points * 1_000_000 }, clock);
  await app.executeTrade(db, userId, preview, clock);
}
/** Trades run oldest first across every goal, so each price path is in order. */
async function trades(list) {
  for (const [userId, marketId, side, points, daysAgo] of [...list].sort((a, b) => b[4] - a[4])) {
    await trade(userId, marketId, side, points, daysAgo);
  }
}

// Open goals across every tab, each with a price path and most with a move today.
const lift = await goal(people.luis, { type: "gym", achievement: "deadlift 315 lb", deadline: easternDate(at(12)) }, 5000, 12);
const club = await goal(people.maya, { type: "club", club: "Buckeye Robotics", deadline: easternDate(at(20)) }, 5500, 6);
const plank = await goal(people.sam, { type: "gym", achievement: "hold a 3-minute plank", deadline: easternDate(at(17)) }, 4500, 9);
const internship = await goal(people.priya, { type: "internship", company: "Google", deadline: easternDate(at(120)) }, 3500, 14);
const cabinet = await goal(people.aisha, { type: "club", club: "the USG cabinet", deadline: easternDate(at(9)) }, 5000, 8);
const race = await goal(people.jordan, { type: "running", distance: "half", time: "1:59:00", deadline: easternDate(at(150)) }, 4500, 10);
const orgo = await goal(people.noor, { type: "own_words", question: "Will I get an A in Organic Chemistry II?",
  criteria: "YES if Noor's official grade for Organic Chemistry II this semester is an A, shown on the grade report.", deadline: easternDate(at(77)) }, 5000, 7);
const song = await goal(people.andre, { type: "own_words", question: "Will I put my first song on Spotify?",
  criteria: "YES if a song credited to Andre is live on Spotify before the deadline.", deadline: easternDate(at(42)) }, 3500, 11);
// Leo's own goal: open, so he sees that he can't trade it.
const fiveK = await goal(people.trader, { type: "running", distance: "5k", time: "25:00", deadline: easternDate(at(38)) }, 5800, 4);
// Older goals for the owner's pages: one past its deadline, one ruled.
const gym = await goal(people.sam, { type: "gym", achievement: "bench press 225 lb", deadline: easternDate(at(-9)) }, 5000, 25);
const gpa = await goal(people.priya, { type: "gpa", gpa: "3.8", semester: "Fall 2026", deadline: easternDate(at(-2)) }, 6000, 20);

const { kai, rosa, theo, wen, ben, trader: leo } = people;
await trades([
  [kai, lift, "YES", 30, 11], [rosa, lift, "YES", 25, 9], [theo, lift, "NO", 15, 7], [wen, lift, "YES", 30, 5],
  [ben, lift, "YES", 20, 3], [leo, lift, "YES", 40, 0.6],
  [leo, club, "NO", 30, 5], [ben, club, "YES", 25, 3], [people.priya, club, "NO", 15, 1], [kai, club, "YES", 20, 0.3],
  [leo, plank, "YES", 35, 4], [theo, plank, "YES", 15, 2], [rosa, plank, "YES", 30, 0.4],
  [theo, internship, "YES", 15, 8], [wen, internship, "NO", 10, 2], [kai, internship, "YES", 10, 0.5],
  [rosa, cabinet, "YES", 20, 6], [theo, cabinet, "NO", 20, 2],
  [wen, race, "NO", 25, 3], [ben, race, "NO", 10, 0.7],
  [kai, orgo, "NO", 10, 4], [rosa, orgo, "NO", 8, 0.8],
  [theo, song, "NO", 30, 2], [wen, song, "NO", 20, 0.3],
  [kai, fiveK, "YES", 10, 1],
  [leo, gym, "YES", 60, 20], [ben, gym, "NO", 10, 15],
  [leo, gpa, "YES", 25, 12], [people.maya, gpa, "NO", 35, 6],
]);

// Proof the owner verified on the deadlift goal, for the dated proof list.
await db.insert(app.schema.evidence).values({
  marketId: lift, submittedBy: people.luis, kind: "file", originalPath: "fixture/luis-gym-log.pdf", originalContentType: "application/pdf",
  originalBytes: 48_000, status: "published", reviewedBy: people.owner, reviewedAt: at(-4), createdAt: at(-4.2),
  verifiedStatement: "Luis sent a gym log showing a 295 lb deadlift last week. Verified by the owner. The original stays private.",
});

// The gym goal: past its deadline and proof period, ruled YES an hour ago, so
// its objection window is open.
const [gymRow] = await db.select().from(app.schema.markets).where(eq(app.schema.markets.id, gym));
await app.applyOwnerCommand(db, people.owner, { marketId: gym, requestId: randomUUID(), action: "rule", expectedVersion: 0,
  outcome: "yes", basis: "reviewed_proof", reason: "Uncut video of the lift reviewed; plates and bar checked." },
  () => new Date(Math.max(gymRow.evidenceDeadlineAt.getTime(), now - 3_600_000)));

// Quinn is banned: their open goal is cancelled and Leo, who bet on it, refunded.
const quinnGoal = await goal(people.quinn, { type: "own_words", question: "Will Quinn swim across Mirror Lake and back?",
  criteria: "YES if a public video shows Quinn swimming across Mirror Lake and back before the deadline.", deadline: easternDate(at(30)) }, 3000, 5);
await trade(people.trader, quinnGoal, "NO", 15, 2);
await app.banPerson(db, people.owner, people.quinn, "Fictional: posting other students' private details.", () => at(-1));

// Proof waiting for the owner.
await db.insert(app.schema.evidence).values({ marketId: gpa, submittedBy: people.priya, kind: "link", linkUrl: "https://example.com/fictional-grade-report" });

// Waiting for the owner, and one turned down, for the review queue and account.
await goal(people.priya, { type: "own_words", question: "Will Priya publish her study-planner app on the App Store?",
  criteria: "YES if the app is listed on the App Store under Priya's developer name before the deadline.", deadline: easternDate(at(60)) }, null, 1);
await goal(people.trader, { type: "gpa", gpa: "3.5", semester: "Fall 2026", deadline: easternDate(at(90)) }, null, 1);
const turnedDown = await goal(people.trader, { type: "own_words", question: "Will Leo feel more confident this semester?",
  criteria: "YES if Leo tells his friends he feels more confident by the deadline.", deadline: easternDate(at(50)) }, null, 3);
await app.rejectDraft(db, people.owner, turnedDown, "Only Leo could decide this one. Try something anyone could check.", at(-2));

// ------------------------------------------------------------ server
const personas = {
  trader: { id: people.trader, label: "Leo, a trader with holdings" },
  owner: { id: people.owner, label: "Ava, the owner" },
  subject: { id: people.maya, label: "Maya, whose goal is open" },
  own: { id: people.trader, label: "Leo, on his own open goal" },
  newcomer: { id: randomUUID(), label: "a new sign-up with no profile yet" },
  nophoto: { id: people.ben, label: "Ben, who has no profile photo" },
  out: { id: null, label: "someone signed out" },
};
const pages = {
  "/account": app.AccountPage, "/goals/new": app.NewGoalPage, "/positions": app.PositionsPage,
  "/review": app.ReviewPage, "/review/markets": app.OutcomesPage, "/review/people": app.PeoplePage, "/feed": app.FeedPage,
};

/** A fictional photo: a silhouette on a colour picked from the handle. Nobody real. */
const photoCache = new Map();
async function servePhoto(handle, response) {
  const [profile] = await db.select().from(app.schema.profiles).where(eq(app.schema.profiles.handle, handle));
  if (!profile?.photoPath || profile.bannedAt) { response.writeHead(404); response.end("No photo."); return; }
  if (!photoCache.has(handle)) {
    let hash = 0;
    for (const ch of handle) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 42%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 28%)"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/><circle cx="256" cy="205" r="95" fill="rgba(255,255,255,0.82)"/><path d="M86 512c0-104 76-176 170-176s170 72 170 176z" fill="rgba(255,255,255,0.82)"/></svg>`;
    photoCache.set(handle, await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer());
  }
  response.writeHead(200, { "Content-Type": "image/webp" });
  response.end(photoCache.get(handle));
}

// The root layout sets the theme and campus on <html>; ?theme=light and ?campus=uiuc pick them here.
function documentFor(title, body, { theme, campus } = {}) {
  return `<!doctype html><html lang="en" data-theme="${theme === "light" ? "light" : "dark"}" data-campus="${campus === "uiuc" ? "uiuc" : "osu"}" class="h-full"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · fictional preview</title><link rel="stylesheet" href="/styles.css"></head><body class="min-h-full flex flex-col">${body}</body></html>`;
}

function index() {
  const links = [];
  for (const [key, persona] of Object.entries(personas)) {
    const routes = key === "owner" ? ["/feed", "/account", "/review", "/review/markets", "/review/people", `/markets/${gym}`]
      : key === "subject" ? ["/account", `/markets/${club}`]
      : key === "own" ? [`/markets/${fiveK}`]
      : key === "newcomer" ? ["/account"]
      : key === "nophoto" ? ["/goals/new", "/account"]
      : key === "out" ? ["/feed"]
      : ["/feed", "/account", "/positions", "/goals/new", `/markets/${lift}`, `/markets/${lift}?side=yes`, `/markets/${club}`, `/markets/${gpa}`];
    links.push(`<section class="account-card"><h2>As ${persona.label}</h2>${routes.map((r) => `<p><a href="${r}${r.includes("?") ? "&" : "?"}as=${key}">${r}</a></p>`).join("")}</section>`);
  }
  return documentFor("Signed-in pages", `<div class="market-shell"><main class="account-main"><section class="account-welcome"><span class="eyebrow">FICTIONAL PREVIEW</span><h1>Signed-in pages</h1><p>Real page components, in-memory data, nobody real. Forms do not submit.</p></section>${links.join("")}</main></div>`);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  response.setHeader("Cache-Control", "no-store");
  // The fonts the stylesheet names, from the build. It names them relative to
  // its own folder, which from /styles.css reads as /media/.
  const asset = url.pathname.match(/^\/(?:_next\/static\/)?(media\/[\w.-]+\.woff2)$/);
  if (asset) {
    const file = await readFile(join(staticDirectory, asset[1])).catch(() => null);
    response.writeHead(file ? 200 : 404, { "Content-Type": "font/woff2" });
    response.end(file ?? "Not found.");
    return;
  }
  if (url.pathname === "/styles.css") { response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" }); response.end(css); return; }
  if (url.pathname === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(index()); return; }
  const photo = url.pathname.match(/^\/photos\/([a-z0-9_]{3,24})$/);
  if (photo) { await servePhoto(photo[1], response); return; }
  const persona = personas[url.searchParams.get("as") ?? "trader"] ?? personas.trader;
  globalThis.__preview.identity = persona.id ? { id: persona.id, email: "fictional@osu.edu" } : null;
  const query = Object.fromEntries(url.searchParams);
  const market = url.pathname.match(/^\/markets\/([0-9a-f-]{36})$/);
  const Page = market ? app.MarketPage : pages[url.pathname];
  // The pages read where they are from the address; the preview serves the feed at /feed.
  globalThis.__preview.search = url.searchParams;
  if (!Page) { response.writeHead(404); response.end("Preview route not found."); return; }
  try {
    const element = await Page({ params: Promise.resolve(market ? { id: market[1] } : {}), searchParams: Promise.resolve(query) });
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(documentFor(url.pathname, renderToStaticMarkup(element), { theme: url.searchParams.get("theme"), campus: url.searchParams.get("campus") }));
  } catch (error) {
    const where = error.previewRedirect ? `redirected to ${error.previewRedirect}` : error.previewNotFound ? "not found" : String(error?.stack ?? error);
    response.writeHead(error.previewRedirect || error.previewNotFound ? 200 : 500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`${url.pathname} as ${persona.label}: ${where}`);
  }
});
server.listen(PORT, phoneMode ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Fictional signed-in preview: http://127.0.0.1:${PORT}. Type stop to close.`);
  if (!phoneMode) return;
  for (const address of Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a.address)) console.log(`On a phone on the same Wi-Fi: http://${address}:${PORT}`);
  console.log("Anyone else on this network can open it too while it runs. Fictional data only.");
});
async function stop() { server.close(); await memory.close(); process.exit(0); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (value) => { if (value.trim() === "stop") stop(); });
