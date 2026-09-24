// Fictional markets for building and reviewing the UI.
//
//   node --env-file=.env.local scripts/preview-feed.mjs          (after npm run build)
//   node --env-file=.env.local scripts/preview-feed.mjs --dev    (hot reload; stop npm run dev first)
//   node --env-file=.env.local scripts/preview-feed.mjs --cleanup (remove fixtures a killed run left)
//   node --env-file=.env.local scripts/preview-feed.mjs --phone   (also reachable from a phone on the same Wi-Fi)
//
// Seeds seven fictional people and fourteen goals, with price paths, trades for
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

const label = (ms) => new Intl.DateTimeFormat("en-US", {
  month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
}).format(new Date(ms));

const people = [
  ["demo_maya", "Maya Chen"],
  ["demo_andre", "Andre Williams"],
  ["demo_priya", "Priya Patel"],
  ["demo_luis", "Luis Ortega"],
  ["demo_jordan", "Jordan Kim"],
  ["demo_sam", "Sam Lee"],
  ["demo_aisha", "Aisha Bello"],
];

// [person, type, question builder, opened days ago, deadline in days, open p, final p, trades, moves in last day]
const goals = [
  [0, "gpa", (n) => `Will ${n} earn at least a 3.8 GPA for Fall 2026?`, 20, 88, 0.45, 0.62, 34, 3],
  [1, "internship", (n, d) => `Will ${n} receive a written internship offer from Google by ${d}?`, 1.2, 150, 0.3, 0.38, 6, 4],
  [2, "gym", (n, d) => `Will ${n} deadlift 315 pounds by ${d}?`, 12, 2.5, 0.5, 0.71, 22, 5],
  [3, "club", (n, d) => `Will ${n} be offered admission to the Chess Club board by ${d}?`, 9, 38, 0.55, 0.47, 18, 2],
  [4, "own_words", () => `Will Jordan get 100 people using their study app?`, 30, 120, 0.25, 0.19, 27, 1],
  [5, "gym", (n, d) => `Will ${n} run a sub-25-minute 5K by ${d}?`, 6, 20, 0.5, 0.83, 19, 6],
  [6, "internship", (n, d) => `Will ${n} receive a written internship offer from Deloitte by ${d}?`, 25, 95, 0.4, 0.58, 29, 0],
  [0, "club", (n, d) => `Will ${n} be offered admission to the Mock Trial team by ${d}?`, 0.3, 30, 0.6, 0.6, 0, 0],
  [2, "gpa", (n) => `Will ${n} earn at least a 3.5 GPA for Fall 2026?`, 16, 88, 0.7, 0.66, 14, 2],
  [3, "gym", (n, d) => `Will ${n} bench 225 pounds by ${d}?`, 0.8, 60, 0.35, 0.41, 3, 3],
  [1, "own_words", () => `Will Andre publish his first song on Spotify?`, 14, 45, 0.5, 0.29, 21, 4],
  [4, "gpa", (n) => `Will ${n} earn at least a 4.0 GPA for Fall 2026?`, 18, 88, 0.2, 0.12, 16, 0],
  [5, "internship", (n, d) => `Will ${n} receive a written internship offer from JPMorgan by ${d}?`, 4, 110, 0.35, 0.44, 9, 2],
  [6, "club", (n, d) => `Will ${n} be offered admission to the Undergraduate Student Government cabinet by ${d}?`, 11, 1.6, 0.4, 0.52, 15, 3],
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

  const subjectIds = [];
  for (const [handle, displayName] of people) {
    const id = randomUUID();
    subjectIds.push(id);
    await client`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at)
      values (${id}, ${handle}, ${displayName}, 0, now())`;
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
  for (const [who, type, build, openedDaysAgo, deadlineDays, openP, finalP, count, recent] of goals) {
    const id = randomUUID();
    const [, displayName] = people[who];
    const first = displayName.split(" ")[0];
    const openedAt = now - openedDaysAgo * DAY;
    const deadlineAt = now + deadlineDays * DAY;
    const question = build(first, label(deadlineAt));
    const openNo = noSharesFor(openP);

    await client`insert into markets (id, subject_user_id, status, question, resolution_criteria, goal_type,
      deadline_at, evidence_deadline_at, liquidity_micro, opening_probability_bp,
      initial_yes_shares_micro, initial_no_shares_micro, yes_shares_micro, no_shares_micro, approved_at, approved_by)
      values (${id}, ${subjectIds[who]}, 'open', ${question},
      ${`YES if ${first} does this before the deadline and supplies proof the owner reviews. Fictional data for layout only.`},
      ${type}, ${new Date(deadlineAt)}, ${new Date(deadlineAt + 7 * DAY)}, ${LIQUIDITY * 1_000_000},
      ${Math.round(openP * 10000)}, 0, ${openNo}, 0, ${noSharesFor(finalP)}, ${new Date(openedAt)}, ${owner})`;

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
  console.log(`${goals.length} goals across ${people.length} people, ${tradeCount} trades, ${pointCount} price points.`);
  console.log("Signed out, so the sign-in prompt appears after two minutes of browsing.");
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
