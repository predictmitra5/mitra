// The founder-video app with its demo data, for building and checking the UI (2026-10-19).
//
//   node --env-file=.env.local scripts/preview-startups.mjs           (next dev, hot reload)
//   node --env-file=.env.local scripts/preview-startups.mjs --cleanup (remove schemas a killed run left)
//
// Creates an isolated, disposable schema in the project's database, applies
// every migration, writes the demo catalog (twenty fictional startups, their
// founders, videos and markets, with simulated trades by fictional demo
// traders) through src/modules/startups/demo/seed.ts, adds two fictional
// accounts (a member funded with 1,000 Trade Coins as a preview fixture, since real accounts start at zero, and the owner), then serves the app
// against it at http://localhost:3100 with `next dev`.
//
// You are Leo, a fictional member, unless the cookie mitra_preview_as says
// "owner" or "visitor" (set it in the browser's developer tools). The
// fictional identity is honoured only by `next dev`
// (src/modules/auth/preview-identity.ts).
//
// Never touches the live app's tables or Auth users. Ctrl+C, or "stop" on
// stdin, removes the schema. A process killed outright gets no chance to; run
// --cleanup then.
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { build } from "esbuild";

if (!process.env.DIRECT_DATABASE_URL) throw new Error("Set DIRECT_DATABASE_URL in .env.local first.");

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

const project = process.cwd();
const name = `mitra_startup_preview_${randomUUID().replaceAll("-", "")}`;
const connection = new URL(process.env.DIRECT_DATABASE_URL);
connection.searchParams.set("search_path", name);
const client = postgres(connection.toString(), { ssl: "require", prepare: false, max: 1, onnotice: () => {} });
let server;
let stopped = false;

async function cleanup() {
  if (stopped) return;
  stopped = true;
  server?.kill();
  if (!/^mitra_startup_preview_[0-9a-f]{32}$/.test(name)) throw new Error("Unsafe preview cleanup target.");
  try {
    await client.unsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    console.log("Isolated preview schema removed.");
  } catch { console.error(`Preview cleanup failed; remove only the test schema ${name} (or run --cleanup).`); process.exitCode = 1; }
  await client.end();
}

// The seeding code is TypeScript in the app; bundle just that, with the app's "@/" alias.
async function loadSeeder() {
  const output = await build({
    stdin: { contents: `export { seedDemo, demoLedgerMismatches } from "@/modules/startups/demo/seed"; export * as schema from "@/db/schema";`, resolveDir: project, loader: "ts" },
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external", logLevel: "error",
    plugins: [{ name: "alias", setup(builder) {
      builder.onResolve({ filter: /^@\// }, (args) => builder.resolve(`./${args.path.slice(2)}`, { resolveDir: resolve(project, "src"), kind: args.kind }));
    } }],
  });
  const compiled = { exports: {} };
  // Runs only the bundle compiled above from this repository's own sources.
  new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  return compiled.exports;
}

try {
  await client.unsafe(`CREATE SCHEMA "${name}"`);
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await client.unsafe(statement.replaceAll('"public".', `"${name}".`));
  }
  const app = await loadSeeder();
  const db = drizzle(client, { schema: app.schema });

  const joined = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const owner = randomUUID(), member = randomUUID();
  for (const [id, handle, displayName, isOwner] of [[owner, "preview_owner", "Ava Okafor (preview owner)", 1], [member, "preview_leo", "Leo Park", 0]]) {
    await client`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at, created_at) values (${id}, ${handle}, ${displayName}, ${isOwner}, ${joined}, ${joined})`;
    await client`insert into wallets (user_id, balance_micro, updated_at) values (${id}, 1000000000, ${joined})`;
    await client`insert into ledger_entries (user_id, kind, amount_micro, memo, created_at) values (${id}, 'signup_grant', 1000000000, 'Preview fixture only', ${joined})`;
  }
  console.log("Seeding the demo catalog…");
  const summary = await app.seedDemo(db, owner, { now: new Date() });
  console.log(`${summary.startups} startups, ${summary.founders} founders, ${summary.videos} videos, ${summary.markets} markets, ${summary.trades} trades, ${summary.pricePoints} price points, ${summary.comments} comments.`);
  console.log(`Wallets that disagree with their ledger: ${await app.demoLedgerMismatches(db)}.`);

  const port = "3100";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port], {
    env: { ...process.env, DATABASE_URL: connection.toString(), MITRA_PREVIEW_PERSONAS: JSON.stringify({ member, owner }) },
    stdio: ["ignore", "inherit", "inherit"], windowsHide: true,
  });
  console.log(`Founder-video preview (next dev): http://localhost:${port}/`);
  console.log("You are Leo, a fictional member with 1,000 Trade Coins (a preview fixture). Set the cookie mitra_preview_as=owner or =visitor to switch.");
  console.log("Press Ctrl+C or send 'stop' on stdin to stop and remove the isolated schema.");
  process.on("SIGINT", () => { void cleanup(); });
  process.on("SIGTERM", () => { void cleanup(); });
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (data) => { if (data.trim() === "stop") void cleanup(); });
  await new Promise((done) => { server.on("exit", done); server.on("error", done); });
} catch (error) {
  console.error("Startup preview failed. No live app rows were changed.", error?.stack ?? error?.message ?? "");
  process.exitCode = 1;
} finally { await cleanup(); process.stdin.pause(); }
