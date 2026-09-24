// Local presentation check for the signed-in pages: account, new goal, your
// predictions, the owner's review queue and outcomes, and a goal page with the
// trade ticket. The real page components render against an in-memory
// PostgreSQL (PGlite) seeded with fictional people through the app's own
// services. No Supabase, no Auth users, no network, no credentials.
//
// Run after `npm run build` (the stylesheet comes from the build):
//   node scripts/preview-signed-in.mjs
// then open http://127.0.0.1:3120. Stop with Ctrl+C or "stop" on stdin.
// Forms render but do not submit: this checks how pages look, not what they do.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq, sql } from "drizzle-orm";

const project = process.cwd();
const PORT = 3120;

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
    export const putOriginal = offline, readOriginal = offline, discardOrphan = offline;
    export async function signedOriginalUrl() { return "#fictional-original"; }`,
  "next/navigation": `
    export function redirect(to) { const e = new Error("redirect"); e.previewRedirect = to; throw e; }
    export function notFound() { const e = new Error("not found"); e.previewNotFound = true; throw e; }
    export function useRouter() { return { push() {}, replace() {}, refresh() {} }; }
    export function usePathname() { return "/"; }
    export function useSearchParams() { return new URLSearchParams(); }`,
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

async function person(handle, displayName) {
  const id = randomUUID();
  await app.provisionAccount(db, id, { displayName, handle, adultConfirmed: true }, at(-30));
  return id;
}
const people = {
  owner: await person("ava", "Ava Okafor"),
  trader: await person("leo", "Leo Park"),
  maya: await person("maya_builds", "Maya Chen"),
  jordan: await person("jordan_p", "Jordan Patel"),
  sam: await person("sam_r", "Sam Rivera"),
  priya: await person("priya_n", "Priya Nair"),
  ben: await person("ben_k", "Ben Kowalski"),
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

const club = await goal(people.maya, { type: "club", club: "Buckeye Robotics", deadline: easternDate(at(20)) }, 5500, 6);
const internship = await goal(people.jordan, { type: "internship", company: "Example Company", deadline: easternDate(at(45)) }, 4000, 10);
const gym = await goal(people.sam, { type: "gym", achievement: "bench press 225 lb", deadline: easternDate(at(-9)) }, 5000, 25);
const gpa = await goal(people.priya, { type: "gpa", gpa: "3.8", semester: "Fall 2026", deadline: easternDate(at(-2)) }, 6000, 20);

await trade(people.trader, club, "YES", 40, 5); await trade(people.ben, club, "YES", 25, 3); await trade(people.priya, club, "NO", 15, 1);
await trade(people.trader, internship, "NO", 30, 8); await trade(people.ben, internship, "YES", 20, 2);
await trade(people.trader, gym, "YES", 60, 20); await trade(people.ben, gym, "NO", 10, 15);
await trade(people.trader, gpa, "YES", 25, 12); await trade(people.maya, gpa, "NO", 35, 6);

// The gym goal: past its deadline and proof period, ruled YES an hour ago, so
// its objection window is open.
const [gymRow] = await db.select().from(app.schema.markets).where(eq(app.schema.markets.id, gym));
await app.applyOwnerCommand(db, people.owner, { marketId: gym, requestId: randomUUID(), action: "rule", expectedVersion: 0,
  outcome: "yes", basis: "reviewed_proof", reason: "Uncut video of the lift reviewed; plates and bar checked." },
  () => new Date(Math.max(gymRow.evidenceDeadlineAt.getTime(), now - 3_600_000)));

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
  newcomer: { id: randomUUID(), label: "a new sign-up with no profile yet" },
};
const pages = {
  "/account": app.AccountPage, "/goals/new": app.NewGoalPage, "/positions": app.PositionsPage,
  "/review": app.ReviewPage, "/review/markets": app.OutcomesPage,
};

function documentFor(title, body) {
  return `<!doctype html><html lang="en" class="h-full antialiased"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · fictional preview</title><link rel="stylesheet" href="/styles.css"></head><body class="min-h-full flex flex-col">${body}</body></html>`;
}

function index() {
  const links = [];
  for (const [key, persona] of Object.entries(personas)) {
    const routes = key === "owner" ? ["/account", "/review", "/review/markets", `/markets/${gym}`]
      : key === "subject" ? ["/account", `/markets/${club}`]
      : key === "newcomer" ? ["/account"]
      : ["/account", "/positions", "/goals/new", `/markets/${club}`, `/markets/${gpa}`];
    links.push(`<section class="account-card"><h2>As ${persona.label}</h2>${routes.map((r) => `<p><a href="${r}?as=${key}">${r}</a></p>`).join("")}</section>`);
  }
  return documentFor("Signed-in pages", `<div class="market-shell"><main class="account-main"><section class="account-welcome"><span class="eyebrow">FICTIONAL PREVIEW</span><h1>Signed-in pages</h1><p>Real page components, in-memory data, nobody real. Forms do not submit.</p></section>${links.join("")}</main></div>`);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  response.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/styles.css") { response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" }); response.end(css); return; }
  if (url.pathname === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(index()); return; }
  const persona = personas[url.searchParams.get("as") ?? "trader"] ?? personas.trader;
  globalThis.__preview.identity = { id: persona.id, email: "fictional@osu.edu" };
  const query = Object.fromEntries(url.searchParams);
  const market = url.pathname.match(/^\/markets\/([0-9a-f-]{36})$/);
  const Page = market ? app.MarketPage : pages[url.pathname];
  if (!Page) { response.writeHead(404); response.end("Preview route not found."); return; }
  try {
    const element = await Page({ params: Promise.resolve(market ? { id: market[1] } : {}), searchParams: Promise.resolve(query) });
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(documentFor(url.pathname, renderToStaticMarkup(element)));
  } catch (error) {
    const where = error.previewRedirect ? `redirected to ${error.previewRedirect}` : error.previewNotFound ? "not found" : String(error?.stack ?? error);
    response.writeHead(error.previewRedirect || error.previewNotFound ? 200 : 500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`${url.pathname} as ${persona.label}: ${where}`);
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Fictional signed-in preview: http://127.0.0.1:${PORT}. Type stop to close.`));
async function stop() { server.close(); await memory.close(); process.exit(0); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (value) => { if (value.trim() === "stop") stop(); });
