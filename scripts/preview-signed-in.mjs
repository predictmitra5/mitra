// Local presentation check for the signed-in pages: the feed, a venue, a market
// with the trade ticket, suggesting a market, the account and positions, and the
// owner's review queue, outcomes and people. The real page components render
// against an in-memory PostgreSQL (PGlite) seeded through the app's own
// services with the three hypothetical Ohio State samples, fictional venues and
// fictional people. No Supabase, no Auth users, no network, no credentials.
//
// Run after `npm run build` (the stylesheet comes from the build):
//   node scripts/preview-signed-in.mjs
// then open http://127.0.0.1:3120. Stop with Ctrl+C or "stop" on stdin.
// Add --phone to open it from a phone on the same Wi-Fi; the addresses are printed.
// Forms render but do not submit: this checks how pages look, not what they do.
// A market page opened with ?side=yes shows the phone's trade sheet open.
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
export { default as SuggestPage } from "@/app/suggest/page";
export { default as VenuePage } from "@/app/venues/[slug]/page";
export { default as PositionsPage } from "@/app/positions/page";
export { default as ReviewPage } from "@/app/review/page";
export { default as OutcomesPage } from "@/app/review/markets/page";
export { default as MarketPage } from "@/app/markets/[id]/page";
export { default as PeoplePage } from "@/app/review/people/page";
export { default as FeedPage } from "@/app/(feed)/page";
export { default as SignUpPage } from "@/app/sign-up/page";
export { default as SignInPage } from "@/app/sign-in/page";
export { default as WelcomePage } from "@/app/welcome/page";
export { banPerson } from "@/modules/account/moderation";
export { provisionAccount } from "@/modules/account/provision";
export { publishMarket, submitProposal, rejectProposal } from "@/modules/events/service";
export { osuSampleMarkets } from "@/modules/events/samples";
export { previewTrade, executeTrade } from "@/modules/market/service";
export { applyOwnerCommand, advanceMarket } from "@/modules/market/lifecycle";
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
  ben: await person("ben_k", "Ben Kowalski", false),
  quinn: await person("quinn_t", "Quinn Taylor"),
  // People who only trade, so prices have somewhere to move.
  kai: await person("kai_w", "Kai Wong"),
  rosa: await person("rosa_m", "Rosa Mendes"),
  theo: await person("theo_b", "Theo Brandt"),
  wen: await person("wen_l", "Wen Li"),
};
await db.update(app.schema.profiles).set({ isOwner: 1 }).where(eq(app.schema.profiles.id, people.owner));

// The three hypothetical Ohio State samples, exactly as the seeding script publishes them.
const samples = {};
for (const { slug, ...input } of app.osuSampleMarkets(new Date(now))) {
  samples[slug] = (await app.publishMarket(db, people.owner, input, new Date(now))).id;
}

/** A fictional event market, opened `openedDaysAgo` with trading until `cutoffDays` from now. */
async function market({ venue, category, question, cutoffDays, windowHours = 4, openingBp, openedDaysAgo, area = "Fictional Avenue" }) {
  const cutoff = at(cutoffDays);
  const windowEnd = new Date(cutoff.getTime() + windowHours * 3_600_000);
  const created = await app.publishMarket(db, people.owner, {
    campus: "osu", category, question, venue: { name: venue, area, description: "A fictional venue for the preview." },
    eventTitle: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "short", day: "numeric" }).format(cutoff),
    windowStartAt: cutoff, windowEndAt: windowEnd, timeZone: "America/New_York",
    tradingCutoffAt: cutoff, resultsDueAt: new Date(windowEnd.getTime() + 3 * DAY),
    yesCondition: "The venue's own count for the window is above the number in the question.",
    noCondition: "The count is at or below that number, or no count arrives by the results deadline.",
    rules: "Fictional market for the preview. Don't buy, or ask anyone to buy, at the venue to move this market.",
    source: { name: `${venue} door count (fictional)`, method: "A fictional count from the venue's own system.", operational: true },
    openingProbabilityBp: openingBp, isSample: false,
  }, at(-openedDaysAgo));
  return created.id;
}
async function trade(userId, marketId, side, points, daysAgo) {
  const clock = () => at(-daysAgo);
  const preview = await app.previewTrade(db, userId, { marketId, side, action: "buy", amountMicro: points * 1_000_000 }, clock);
  await app.executeTrade(db, userId, preview, clock);
}
/** Trades run oldest first across every market, so each price path is in order. */
async function trades(list) {
  for (const [userId, marketId, side, points, daysAgo] of [...list].sort((a, b) => b[4] - a[4])) {
    await trade(userId, marketId, side, points, daysAgo);
  }
}

// Open markets across the categories, each with a price path and most with a move today.
const comedy = await market({ venue: "Lakeside Comedy Club", category: "events", question: "Will the Lakeside Comedy Club's 9 PM show sell out on Saturday?", cutoffDays: 3, openingBp: 4500, openedDaysAgo: 6 });
const rec = await market({ venue: "North Quad Rec", category: "campus", question: "Will more than 300 people check in at North Quad Rec on Sunday?", cutoffDays: 4, openingBp: 5500, openedDaysAgo: 5 });
const bowling = await market({ venue: "Brick Row Lanes", category: "entertainment", question: "Will Brick Row Lanes book every lane for Friday's late session?", cutoffDays: 9, openingBp: 3500, openedDaysAgo: 8 });
const tacos = await market({ venue: "Lantern Tacos", category: "food", question: "Will Lantern Tacos sell more than 800 tacos on Taco Tuesday?", cutoffDays: 13, openingBp: 6000, openedDaysAgo: 4, area: "Fictional Street" });
// Past markets for the status filter and the owner's outcomes page.
const closed = await market({ venue: "Lantern Tacos", category: "food", question: "Will Lantern Tacos run out of al pastor before 10 PM?", cutoffDays: -1, openingBp: 5000, openedDaysAgo: 9, area: "Fictional Street" });
const ruled = await market({ venue: "Brick Row Lanes", category: "entertainment", question: "Will Brick Row Lanes' trivia night draw 20 teams?", cutoffDays: -2, windowHours: 3, openingBp: 4000, openedDaysAgo: 10 });
const voided = await market({ venue: "North Quad Rec", category: "campus", question: "Will the North Quad Rec climbing wall open on time?", cutoffDays: -3, openingBp: 5000, openedDaysAgo: 12 });

const { kai, rosa, theo, wen, ben, trader: leo, maya } = people;
await trades([
  [kai, samples["midway-on-high"], "YES", 20, 0.4], [rosa, samples["buckeye-donuts"], "NO", 15, 0.2], [leo, samples["smith-steeb-hall"], "YES", 25, 0.3],
  [kai, comedy, "YES", 30, 5], [rosa, comedy, "YES", 25, 3], [theo, comedy, "NO", 15, 2], [leo, comedy, "YES", 40, 0.6],
  [leo, rec, "NO", 30, 4], [ben, rec, "YES", 25, 3], [maya, rec, "NO", 15, 1], [kai, rec, "YES", 20, 0.3],
  [theo, bowling, "YES", 15, 7], [wen, bowling, "NO", 10, 2], [kai, bowling, "YES", 10, 0.5],
  [rosa, tacos, "YES", 20, 3], [theo, tacos, "NO", 20, 1],
  [leo, closed, "YES", 30, 5], [wen, closed, "NO", 15, 3],
  [leo, ruled, "YES", 20, 8], [maya, ruled, "NO", 25, 6],
  [leo, voided, "NO", 15, 10],
]);

// Close the past ones, rule one an hour ago (objections open), void another.
for (const id of [closed, ruled, voided]) await app.advanceMarket(db, id, () => new Date(now));
await app.applyOwnerCommand(db, people.owner, { marketId: ruled, requestId: randomUUID(), action: "rule", expectedVersion: 0,
  outcome: "yes", basis: "checked_source", reason: "Brick Row's sign-in sheet shows 23 teams." }, () => new Date(now - 3_600_000));
await app.applyOwnerCommand(db, people.owner, { marketId: voided, requestId: randomUUID(), action: "cancel", expectedVersion: 0,
  reason: "The climbing wall's opening was rescheduled, so the market can't be settled as written." }, () => new Date(now - 2 * 3_600_000));

// Suggestions: two waiting, one turned down, one published as the tacos market's sibling.
const suggestion = (who, question, category, venueName, days, note) => app.submitProposal(db, who, "osu", {
  question, category, venueName, windowStartAt: at(days), windowEndAt: new Date(at(days).getTime() + 3 * 3_600_000), resolutionNote: note,
}, at(-1));
await suggestion(maya, "Will the Lakeside Comedy Club add a second show on Friday?", "events", "Lakeside Comedy Club", 6, "The club's own listings page.");
await suggestion(leo, "Will Buckeye Donuts sell more than 2,000 donuts on game day?", "food", "Buckeye Donuts", 10, "The shop's register count for the day.");
const turnedDown = await suggestion(leo, "Will my roommate finally do the dishes?", "campus", "Our apartment", 3, "I'll check the sink.");
await app.rejectProposal(db, people.owner, turnedDown.id, "That's about one person, and Mitra's markets are about places. Try a venue's count.", at(-0.5));
// Quinn is banned: their waiting suggestion is turned down with the ban.
await suggestion(people.quinn, "Will the Oval be packed on Saturday?", "campus", "The Oval", 4, "A headcount.");
await app.banPerson(db, people.owner, people.quinn, "Fictional: posting other students' private details.", () => at(-0.2));

// ------------------------------------------------------------ server
const personas = {
  trader: { id: people.trader, label: "Leo, a trader with holdings and suggestions" },
  owner: { id: people.owner, label: "Ava, the owner" },
  newcomer: { id: randomUUID(), label: "a new sign-up with no profile yet" },
  out: { id: null, label: "someone signed out" },
};
const pages = {
  "/account": app.AccountPage, "/suggest": app.SuggestPage, "/positions": app.PositionsPage,
  "/review": app.ReviewPage, "/review/markets": app.OutcomesPage, "/review/people": app.PeoplePage, "/feed": app.FeedPage,
  "/sign-up": app.SignUpPage, "/sign-in": app.SignInPage, "/welcome": app.WelcomePage,
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
    const routes = key === "owner" ? ["/feed", "/account", "/review", "/review/markets", "/review/people", `/markets/${ruled}`]
      : key === "newcomer" ? ["/account", "/welcome"]
      : key === "out" ? ["/feed", `/markets/${samples["midway-on-high"]}`, "/venues/midway-on-high", "/sign-up", "/sign-in"]
      : ["/feed", "/feed?status=all", "/feed?cat=food", "/venues/lantern-tacos", "/account", "/positions", "/suggest", "/welcome?step=topics", "/welcome?step=how",
        `/markets/${samples["midway-on-high"]}`, `/markets/${comedy}`, `/markets/${comedy}?side=yes`, `/markets/${ruled}`, `/markets/${voided}`];
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
  globalThis.__preview.identity = persona.id ? { id: persona.id, email: "fictional@osu.edu", campus: "osu" } : null;
  const query = Object.fromEntries(url.searchParams);
  const market = url.pathname.match(/^\/markets\/([0-9a-f-]{36})$/);
  const venue = url.pathname.match(/^\/venues\/([a-z0-9-]{1,70})$/);
  const Page = market ? app.MarketPage : venue ? app.VenuePage : pages[url.pathname];
  // The pages read where they are from the address; the preview serves the feed at /feed.
  globalThis.__preview.search = url.searchParams;
  if (!Page) { response.writeHead(404); response.end("Preview route not found."); return; }
  try {
    const element = await Page({ params: Promise.resolve(market ? { id: market[1] } : venue ? { slug: venue[1] } : {}), searchParams: Promise.resolve(query) });
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
