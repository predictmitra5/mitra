// Run after `npm run build`: node --env-file=.env.local scripts/preview-market.mjs
// Uses an isolated, disposable schema; never seeds the live app or Auth users.
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

if (!process.env.DIRECT_DATABASE_URL) throw new Error("Set DIRECT_DATABASE_URL in .env.local first.");
const name = `mitra_preview_${randomUUID().replaceAll("-", "")}`;
const connection = new URL(process.env.DIRECT_DATABASE_URL);
connection.searchParams.set("search_path", name);
const client = postgres(connection.toString(), { ssl: "require", prepare: false, max: 1, onnotice: () => {} });
let server;
let stopped = false;

async function cleanup() {
  if (stopped) return;
  stopped = true;
  server?.kill();
  if (!/^mitra_preview_[0-9a-f]{32}$/.test(name)) throw new Error("Unsafe preview cleanup target.");
  try {
    await client.unsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    console.log("Isolated preview schema removed.");
  } catch { console.error(`Preview cleanup failed; remove only the test schema ${name}.`); process.exitCode = 1; }
  await client.end();
}

try {
  await client.unsafe(`CREATE SCHEMA "${name}"`);
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await client.unsafe(statement.replaceAll('"public".', `"${name}".`));
  }
  const owner = randomUUID(), subject = randomUUID(), market = randomUUID();
  await client`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at) values
    (${owner}, 'demo_owner', 'Demo owner', 1, now()), (${subject}, 'demo_student', 'Demo student', 0, now())`;
  const noShares = Math.round(150 * Math.log(0.7 / 0.3) * 1_000_000);
  await client`insert into markets (id, subject_user_id, status, question, resolution_criteria, goal_type,
    deadline_at, evidence_deadline_at, liquidity_micro, opening_probability_bp,
    initial_yes_shares_micro, initial_no_shares_micro, yes_shares_micro, no_shares_micro, approved_at, approved_by)
    values (${market}, ${subject}, 'open', 'Will Demo student receive a written internship offer by March 1, 2027?',
    'YES if the student receives a written internship offer from Example Company before the deadline, even if they decline it. A written offer must be supplied for review. This is fictional test data.',
    'internship', '2027-03-02T04:59:00Z', '2027-03-09T04:59:00Z', 150000000, 3000, 0, ${noShares}, 0, ${noShares}, now(), ${owner})`;
  const port = "3100";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
    env: { ...process.env, DATABASE_URL: connection.toString() }, stdio: ["ignore", "inherit", "inherit"], windowsHide: true,
  });
  console.log(`Fictional goal preview: http://localhost:${port}/markets/${market}`);
  console.log("Press Ctrl+C or send 'stop' on stdin to stop and remove the isolated fixture.");
  process.on("SIGINT", () => { void cleanup(); });
  process.on("SIGTERM", () => { void cleanup(); });
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (data) => { if (data.trim() === "stop") void cleanup(); });
  await new Promise((resolve) => { server.on("exit", resolve); server.on("error", resolve); });
} catch { console.error("Isolated browser preview failed. No live app rows were changed."); process.exitCode = 1; }
finally { await cleanup(); process.stdin.pause(); }
