// Run after `npm run build`: node --env-file=.env.local scripts/preview-feed.mjs
// Uses an isolated, disposable schema; never seeds the live app or Auth users.
// Seeds several fictional people and goals so the feed's tabs, "Just added" row,
// ranking and per-subject cap can all be seen at once.
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

if (!process.env.DIRECT_DATABASE_URL) throw new Error("Set DIRECT_DATABASE_URL in .env.local first.");
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

const hour = 3_600_000;
const liquidityMicro = 150_000_000;
/** Market-maker no-shares for an opening probability, matching the engine. */
const noSharesFor = (probability) => Math.round(150 * Math.log((1 - probability) / probability) * 1_000_000);

const people = [
  { handle: "demo_maya", displayName: "Maya" },
  { handle: "demo_andre", displayName: "Andre" },
  { handle: "demo_priya", displayName: "Priya" },
  { handle: "demo_luis", displayName: "Luis" },
];

// approvedHoursAgo drives the newborn bonus and the time decay; clicks drive activity.
const goals = [
  { person: 0, type: "gpa", text: "finish the fall semester with a 3.8 GPA or higher", approvedHoursAgo: 2, deadlineDays: 90, probability: 0.45, clicks: 0 },
  { person: 1, type: "internship", text: "receive a written summer internship offer", approvedHoursAgo: 6, deadlineDays: 120, probability: 0.3, clicks: 3 },
  { person: 2, type: "gym", text: "deadlift 315 pounds", approvedHoursAgo: 30, deadlineDays: 2, probability: 0.62, clicks: 12 },
  { person: 0, type: "club", text: "be elected to the Chess Club board", approvedHoursAgo: 200, deadlineDays: 40, probability: 0.55, clicks: 26 },
  { person: 0, type: "launch", text: "publish a working version of their side project", approvedHoursAgo: 210, deadlineDays: 60, probability: 0.4, clicks: 22 },
  { person: 0, type: "gym", text: "run a sub-25-minute 5K", approvedHoursAgo: 220, deadlineDays: 75, probability: 0.5, clicks: 20 },
  { person: 3, type: "club", text: "join the debate team", approvedHoursAgo: 400, deadlineDays: 20, probability: 0.7, clicks: 4 },
  { person: 1, type: "gpa", text: "pass organic chemistry", approvedHoursAgo: 600, deadlineDays: 110, probability: 0.8, clicks: 1 },
  { person: 2, type: "launch", text: "get 100 people using their app", approvedHoursAgo: 900, deadlineDays: 150, probability: 0.25, clicks: 0 },
];

try {
  await client.unsafe(`CREATE SCHEMA "${name}"`);
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await client.unsafe(statement.replaceAll('"public".', `"${name}".`));
  }

  const owner = randomUUID();
  await client`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at)
    values (${owner}, 'demo_owner', 'Demo owner', 1, now())`;

  const ids = [];
  for (const person of people) {
    const id = randomUUID();
    ids.push(id);
    await client`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at)
      values (${id}, ${person.handle}, ${person.displayName}, 0, now())`;
  }

  for (const goal of goals) {
    const id = randomUUID();
    const subject = ids[goal.person];
    const who = people[goal.person].displayName;
    const approvedAt = new Date(Date.now() - goal.approvedHoursAgo * hour);
    const deadlineAt = new Date(Date.now() + goal.deadlineDays * 24 * hour);
    const evidenceAt = new Date(deadlineAt.getTime() + 7 * 24 * hour);
    const noShares = noSharesFor(goal.probability);

    await client`insert into markets (id, subject_user_id, status, question, resolution_criteria, goal_type,
      deadline_at, evidence_deadline_at, liquidity_micro, opening_probability_bp,
      initial_yes_shares_micro, initial_no_shares_micro, yes_shares_micro, no_shares_micro, approved_at, approved_by)
      values (${id}, ${subject}, 'open',
      ${`Will ${who} ${goal.text} by the deadline?`},
      ${`YES if ${who} does this before the deadline and supplies proof for review. This is fictional test data for layout only.`},
      ${goal.type}, ${deadlineAt}, ${evidenceAt}, ${liquidityMicro}, ${Math.round(goal.probability * 10000)},
      0, ${noShares}, 0, ${noShares}, ${approvedAt}, ${owner})`;

    for (let i = 0; i < goal.clicks; i += 1) {
      await client`insert into feed_events (market_id, kind, created_at)
        values (${id}, 'click', ${new Date(Date.now() - Math.floor(Math.random() * 20) * hour)})`;
    }
  }

  const port = "3100";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
    env: { ...process.env, DATABASE_URL: connection.toString() }, stdio: ["ignore", "inherit", "inherit"], windowsHide: true,
  });
  console.log(`Fictional feed preview: http://localhost:${port}/`);
  console.log(`${goals.length} goals across ${people.length} people. Maya holds four, to show the per-subject cap.`);
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
