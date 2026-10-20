// Fictional markets for building and reviewing the UI.
//
//   node --env-file=.env.local scripts/preview-feed.mjs          (after npm run build)
//   node --env-file=.env.local scripts/preview-feed.mjs --dev    (hot reload; stop npm run dev first)
//   node --env-file=.env.local scripts/preview-feed.mjs --cleanup (remove fixtures a killed run left)
//   node --env-file=.env.local scripts/preview-feed.mjs --phone   (also reachable from a phone on the same Wi-Fi)
//
// Seeds eight fictional venues and fourteen event markets (2026-10-08), open,
// closed and void, two of them marked Sample, with price paths, trades for
// volume and recent movement, into an isolated, disposable schema, then serves
// the whole app against it at http://localhost:3100, signed out. It never seeds
// the live app or creates Auth users. Ctrl+C, or "stop" on stdin, removes it.
// A process killed outright (a closed terminal or Task Manager on Windows) gets
// no chance to clean up; --cleanup then removes every preview schema.
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

if (!process.env.DIRECT_DATABASE_URL) throw new Error("Set DIRECT_DATABASE_URL in .env.local first.");

// Only schemas the preview scripts name, never anything else.
const PREVIEW_SCHEMA = /^mitra_[a-z_]*preview_[0-9a-f]{32}$/;
if (process.argv.includes("--cleanup")) {
  const sweep = postgres(process.env.DIRECT_DATABASE_URL, { ssl: "require", prepare: false, max: 1, onnotice: () => {} });
  try {
    const found = await sweep`select nspname from pg_namespace where nspname ~ ${PREVIEW_SCHEMA.source}`;
    for (const { nspname } of found) {
      if (!PREVIEW_SCHEMA.test(nspname)) throw new Error("Unsafe preview cleanup target.");
      await sweep.unsafe(`DROP SCHEMA IF EXISTS "${nspname}" CASCADE`);
      console.log("Removed leftover preview schema", nspname);
    }
    console.log(found.length ? "Done." : "No preview schemas left behind.");
  } finally { await sweep.end(); }
  process.exit(0);
}

const devMode = process.argv.includes("--dev");
// A phone is another origin, and the dev server blocks its own scripts for
// other origins, so phone mode serves the built app.
const phoneMode = process.argv.includes("--phone");
if (phoneMode && devMode) throw new Error("--phone serves the built app: run npm run build, then use --phone without --dev.");
const name = `mitra_feed_preview_${randomUUID().replaceAll("-", "")}`;
const connection = new URL(process.env.DIRECT_DATABASE_URL);
connection.searchParams.set("search_path", name);
const client = postgres(connection.toString(), { ssl: "require", prepare: false, max: 1, onnotice: () => {} });
let server;
let stopped = false;

async function cleanup() {
  if (stopped) return;
  stopped = true;
  server?.kill();
  if (!/^mitra_feed_preview_[0-9a-f]{32}$/.test(name)) throw new Error("Unsafe preview cleanup target.");
  try {
    await client.unsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    console.log("Isolated preview schema removed.");
  } catch { console.error(`Preview cleanup failed; remove only the test schema ${name}.`); process.exitCode = 1; }
  await client.end();
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LIQUIDITY = 150;
const now = Date.now();

/** Seeded so every run draws the same fictional world. */
let seed = 20260922;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** Market-maker NO shares that put the YES price at p, with YES shares at zero. */
const noSharesFor = (p) => Math.round(LIQUIDITY * Math.log((1 - p) / p) * 1_000_000);

const clock = (ms) => new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "numeric", hour: "numeric", timeZone: "America/New_York",
}).format(new Date(ms));

// Fictional venues only: no real business appears in this preview.
// [name, slug, category]
const venues = [
  ["Lantern Tacos", "lantern-tacos", "food"],
  ["Brick Row Lanes", "brick-row-lanes", "entertainment"],
  ["Lakeside Comedy Club", "lakeside-comedy-club", "events"],
  ["North Quad Rec", "north-quad-rec", "campus"],
  ["The Copper Owl", "the-copper-owl", "nightlife"],
  ["Hilltop Cinema", "hilltop-cinema", "entertainment"],
  ["Night Owl Noodles", "night-owl-noodles", "food"],
  ["Fourth Street Hall", "fourth-street-hall", "events"],
];

// [venue, question builder, opened days ago, cutoff in days, open p, final p, trades, moves in last day, status, sample]
const markets = [
  [0, (w) => `Will Lantern Tacos sell more than 800 tacos on ${w}?`, 6, 3, 0.45, 0.62, 24, 3, "open", false],
  [1, (w) => `Will Brick Row Lanes book every lane for ${w}?`, 1.2, 9, 0.3, 0.38, 6, 4, "open", false],
  [2, (w) => `Will the Lakeside Comedy Club's late show sell out on ${w}?`, 8, 2.5, 0.5, 0.71, 22, 5, "open", true],
  [3, (w) => `Will more than 300 people check in at North Quad Rec on ${w}?`, 9, 5, 0.55, 0.47, 18, 2, "open", false],
  [4, (w) => `Will The Copper Owl hit capacity before 11 PM on ${w}?`, 12, 4, 0.25, 0.19, 27, 1, "open", false],
  [5, (w) => `Will Hilltop Cinema's 7 PM showing sell more than 150 tickets on ${w}?`, 6, 6, 0.5, 0.83, 19, 6, "open", true],
  [6, (w) => `Will Night Owl Noodles sell 400 bowls after midnight on ${w}?`, 10, 8, 0.4, 0.58, 21, 0, "open", false],
  [7, (w) => `Will Fourth Street Hall's open mic fill all 20 slots on ${w}?`, 0.3, 12, 0.6, 0.6, 0, 0, "open", false],
  [0, (w) => `Will Lantern Tacos run out of al pastor before 10 PM on ${w}?`, 7, 10, 0.7, 0.66, 14, 2, "open", false],
  [4, (w) => `Will The Copper Owl's trivia night draw 25 teams on ${w}?`, 0.8, 14, 0.35, 0.41, 3, 3, "open", false],
  [1, (w) => `Will Brick Row Lanes' cosmic bowling sell out on ${w}?`, 14, 1.6, 0.5, 0.29, 21, 4, "open", false],
  [3, (w) => `Will the North Quad Rec pool hit 100 swimmers on ${w}?`, 4, 11, 0.35, 0.44, 9, 2, "open", false],
  [6, (w) => `Will Night Owl Noodles open a second line on ${w}?`, 11, -1, 0.4, 0.52, 15, 0, "closed", false],
  [2, (w) => `Will the Lakeside Comedy Club's headliner sell 200 seats on ${w}?`, 12, -2, 0.5, 0.45, 8, 0, "cancelled", false],
];

/**
 * A price path from the opening price to the final one: a walk with drift,
 * bounded away from certainty, with some moves pushed into the last day so the
 * "moving today" list and the 24-hour change have something to show.
 */
function pricePath(openP, finalP, count, recent, openedAt) {
  const points = [{ at: openedAt, p: openP }];
  if (count === 0) return points;
  const older = count - recent;
  const lastDay = now - DAY;
  const oldEnd = Math.max(openedAt + HOUR, Math.min(lastDay, now - HOUR));
  const times = [];
  for (let i = 0; i < older; i += 1) times.push(openedAt + ((i + 1) / (older + 1)) * (oldEnd - openedAt));
  for (let i = 0; i < recent; i += 1) times.push(Math.max(openedAt + HOUR, lastDay) + ((i + 1) / (recent + 1)) * (now - Math.max(openedAt + HOUR, lastDay)));
  times.sort((a, b) => a - b);
  let p = openP;
  times.forEach((at, i) => {
    const remaining = times.length - i;
    const drift = (finalP - p) / remaining;
    const noise = (random() - 0.5) * 0.09;
    p = i === times.length - 1 ? finalP : Math.min(0.96, Math.max(0.04, p + drift + noise));
    points.push({ at, p });
  });
  return points;
}

try {
  await client.unsafe(`CREATE SCHEMA "${name}"`);
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await client.unsafe(statement.replaceAll('"public".', `"${name}".`));
  }

  const owner = randomUUID();
  await client`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at)
    values (${owner}, 'demo_owner', 'Demo owner', 1, now())`;

  const venueIds = [];
  for (const [venueName, slug, category] of venues) {
    const id = randomUUID();
    venueIds.push(id);
    await client`insert into venues (id, campus, slug, name, category, area, description)
      values (${id}, 'osu', ${slug}, ${venueName}, ${category}, 'Fictional Avenue', 'A fictional venue for layout only.')`;
  }

  // Fictional traders, so trades have somebody to belong to.
  const traders = [];
  for (let i = 1; i <= 6; i += 1) {
    const id = randomUUID();
    traders.push(id);
    await client`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at)
      values (${id}, ${`demo_trader_${i}`}, ${`Demo trader ${i}`}, 0, now())`;
  }

  let tradeCount = 0;
  let pointCount = 0;
  for (const [venue, build, openedDaysAgo, cutoffDays, openP, finalP, count, recent, status, sample] of markets) {
    const id = randomUUID();
    const [venueName, , category] = venues[venue];
    const openedAt = now - openedDaysAgo * DAY;
    const cutoffAt = now + cutoffDays * DAY;
    const windowEnd = cutoffAt + 4 * HOUR;
    const question = build(clock(cutoffAt));
    // The card's short title (2026-10-09): the question without its day.
    const shortQuestion = question.replace(` on ${clock(cutoffAt)}`, "");
    const openNo = noSharesFor(openP);
    const source = randomUUID();
    const event = randomUUID();
    await client`insert into resolution_sources (id, name, method, operational)
      values (${source}, ${`${venueName} count (fictional)`}, 'A fictional count from the venue, for layout only.', ${!sample})`;
    await client`insert into events (id, venue_id, title, starts_at, ends_at, time_zone)
      values (${event}, ${venueIds[venue]}, ${clock(cutoffAt)}, ${new Date(cutoffAt)}, ${new Date(windowEnd)}, 'America/New_York')`;

    await client`insert into markets (id, status, question, short_question, resolution_criteria, campus, category, venue_id, event_id,
      resolution_source_id, window_start_at, window_end_at, time_zone, yes_condition, no_condition, is_sample,
      deadline_at, evidence_deadline_at, trading_closed_at, cancelled_at, cancel_reason, liquidity_micro, opening_probability_bp,
      initial_yes_shares_micro, initial_no_shares_micro, yes_shares_micro, no_shares_micro, approved_at, approved_by)
      values (${id}, ${status}, ${question}, ${shortQuestion}, 'Fictional data for layout only.', 'osu', ${category}, ${venueIds[venue]}, ${event},
      ${source}, ${new Date(cutoffAt)}, ${new Date(windowEnd)}, 'America/New_York',
      'The venue count is above the number in the question.', 'The count is at or below it, or none arrives by the results deadline.', ${sample},
      ${new Date(cutoffAt)}, ${new Date(windowEnd + 3 * DAY)}, ${status === "open" ? null : new Date(cutoffAt)},
      ${status === "cancelled" ? new Date(now - HOUR) : null}, ${status === "cancelled" ? "Fictional: rescheduled." : null},
      ${LIQUIDITY * 1_000_000}, ${Math.round(openP * 10000)}, 0, ${openNo}, 0, ${noSharesFor(finalP)}, ${new Date(openedAt)}, ${owner})`;

    const path = pricePath(openP, finalP, count, recent, openedAt);
    for (let i = 0; i < path.length; i += 1) {
      const point = path[i];
      let tradeId = null;
      if (i > 0) {
        tradeId = randomUUID();
        const before = path[i - 1].p;
        const side = point.p >= before ? "yes" : "no";
        const amount = Math.round((5 + random() * 55) * 1_000_000);
        await client`insert into trades (id, market_id, user_id, side, action, shares_micro, amount_micro,
          request_amount_micro, yes_price_before_bp, yes_price_after_bp, idempotency_key, created_at)
          values (${tradeId}, ${id}, ${traders[Math.floor(random() * traders.length)]}, ${side}, 'buy',
          ${Math.round(amount * 1.6)}, ${amount}, ${amount}, ${Math.round(before * 10000)},
          ${Math.round(point.p * 10000)}, ${`preview-${tradeId}`}, ${new Date(point.at)})`;
        tradeCount += 1;
      }
      await client`insert into price_history (market_id, yes_price_bp, trade_id, recorded_at)
        values (${id}, ${Math.round(point.p * 10000)}, ${tradeId}, ${new Date(point.at)})`;
      pointCount += 1;
    }

    const clicks = Math.floor(random() * 25);
    for (let i = 0; i < clicks; i += 1) {
      await client`insert into feed_events (market_id, kind, created_at)
        values (${id}, 'click', ${new Date(now - Math.floor(random() * 20) * HOUR)})`;
    }
  }

  const port = "3100";
  const args = devMode
    ? ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port]
    : ["node_modules/next/dist/bin/next", "start", "--hostname", phoneMode ? "0.0.0.0" : "127.0.0.1", "--port", port];
  server = spawn(process.execPath, args, {
    env: { ...process.env, DATABASE_URL: connection.toString() }, stdio: ["ignore", "inherit", "inherit"], windowsHide: true,
  });
  console.log(`Fictional feed preview${devMode ? " (dev, hot reload)" : ""}: http://localhost:${port}/`);
  if (phoneMode) {
    for (const address of Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a.address)) console.log(`On a phone on the same Wi-Fi: http://${address}:${port}/`);
    console.log("Anyone else on this network can open it too while it runs. Fictional data only.");
  }
  console.log(`${markets.length} markets across ${venues.length} fictional venues, ${tradeCount} trades, ${pointCount} price points.`);
  console.log("Signed out, so the sign-up pop-up appears after 30 seconds of browsing.");
  console.log("Press Ctrl+C or send 'stop' on stdin to stop and remove the isolated fixture.");
  process.on("SIGINT", () => { void cleanup(); });
  process.on("SIGTERM", () => { void cleanup(); });
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (data) => { if (data.trim() === "stop") void cleanup(); });
  await new Promise((resolve) => { server.on("exit", resolve); server.on("error", resolve); });
} catch (error) {
  console.error("Isolated feed preview failed. No live app rows were changed.", error?.message ?? "");
  process.exitCode = 1;
} finally { await cleanup(); process.stdin.pause(); }
