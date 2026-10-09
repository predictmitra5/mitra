// The live steps of the 2026-10-08 pivot to campus event markets, run once on
// the owner's go-ahead (DECISIONS.md, 2026-10-08):
//
//   node --env-file=.env.local scripts/event-pivot-go-live.mjs           read-only report of what would happen
//   node --env-file=.env.local scripts/event-pivot-go-live.mjs --apply   do it
//
// With more than one owner account, name the accounts the steps are recorded
// under: --owner=<handle>[,<handle>]. The first acts; every record names them all.
//
// The steps are in src/modules/events/go-live.ts, tested against an in-memory
// copy of the live state: record migration 0012, apply 0013, void and refund
// the remaining goal markets, publish the three Ohio State samples. Each step
// is safe to run again. It uses DIRECT_DATABASE_URL (the session pooler) and
// prints no credentials.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

if (!process.env.DIRECT_DATABASE_URL) throw new Error("Set DIRECT_DATABASE_URL in .env.local first.");
const project = process.cwd();

// The app's own code, bundled from source, so the live steps run exactly the tested code.
const output = await build({
  stdin: {
    contents: `export { runEventPivot } from "@/modules/events/go-live"; export * as schema from "@/db/schema";`,
    resolveDir: project, loader: "ts",
  },
  bundle: true, write: false, format: "cjs", platform: "node", packages: "external", logLevel: "error",
  plugins: [{ name: "aliases", setup(builder) {
    builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "stub" }));
    builder.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export {};", loader: "js" }));
    builder.onResolve({ filter: /^@\// }, (args) => builder.resolve(`./${args.path.slice(2)}`, { resolveDir: resolve(project, "src"), kind: args.kind }));
  } }],
});
const compiled = { exports: {} };
// Execute only the bundle compiled above from this repository's own sources.
new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const app = compiled.exports;

const client = postgres(process.env.DIRECT_DATABASE_URL, { ssl: "require", prepare: false, max: 1, onnotice: () => {} });
const db = drizzle(client, { schema: app.schema });
const journal = JSON.parse(readFileSync("./drizzle/meta/_journal.json", "utf8"));

try {
  const result = await app.runEventPivot(db, {
    apply: process.argv.includes("--apply"),
    migrations: readMigrationFiles({ migrationsFolder: "./drizzle" }),
    withdrawalMillis: journal.entries.find((entry) => entry.tag === "0012_account_withdrawal").when,
    migrate: () => migrate(db, { migrationsFolder: "./drizzle" }),
    ownerHandles: process.argv.find((arg) => arg.startsWith("--owner="))?.slice("--owner=".length).split(",").map((handle) => handle.trim().replace(/^@/, "")).filter(Boolean),
    log: (line) => console.log(line),
  });
  if (process.argv.includes("--apply")) {
    const [{ drift }] = await client`select count(*)::int as drift from wallets w
      where w.balance_micro <> (select coalesce(sum(amount_micro), 0) from ledger_entries l where l.user_id = w.user_id)`;
    console.log(`Done: ${result.voided} goal market(s) voided, ${result.published.length} sample(s) published. Wallets that disagree with the ledger: ${drift}.`);
  }
} finally {
  await client.end();
}
