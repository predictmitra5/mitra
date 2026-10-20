// The live steps of the 2026-10-19 pivot to founder videos and startup markets,
// run once on the owner's go-ahead (DECISIONS.md, 2026-10-19):
//
//   node --env-file=.env.local scripts/startup-pivot-go-live.mjs           read-only report of what would happen
//   node --env-file=.env.local scripts/startup-pivot-go-live.mjs --apply   do it
//
// With more than one owner account, name the accounts the steps are recorded
// under: --owner=<handle>[,<handle>]. The first acts; every record names them all.
// Add --no-demo to leave out the fictional demo catalog.
//
// The steps are in src/modules/startups/go-live.ts, tested against an
// in-memory copy of the live database: record migrations 0014 to 0017, which
// were applied by hand on 2026-10-12 and 13 but never recorded (each only after
// checking everything it creates is there), apply migration 0018, void and
// refund the event markets still live, write the demo catalog. Each step is
// safe to run again. It uses DIRECT_DATABASE_URL (the session pooler) and
// prints no credentials.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

if (!process.env.DIRECT_DATABASE_URL) throw new Error("Set DIRECT_DATABASE_URL in .env.local first.");
const project = process.cwd();

// The app's own code, bundled from source, so the live steps run exactly the tested code.
const output = await build({
  stdin: {
    contents: `export { runStartupPivot } from "@/modules/startups/go-live"; export * as schema from "@/db/schema";`,
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
try {
  const result = await app.runStartupPivot(db, {
    apply: process.argv.includes("--apply"),
    withoutDemo: process.argv.includes("--no-demo"),
    migrate: () => migrate(db, { migrationsFolder: "./drizzle" }),
    ownerHandles: process.argv.find((arg) => arg.startsWith("--owner="))?.slice("--owner=".length).split(",").map((handle) => handle.trim().replace(/^@/, "")).filter(Boolean),
    log: (line) => console.log(line),
  });
  if (process.argv.includes("--apply")) {
    const [{ drift }] = await client`select count(*)::int as drift from wallets w
      where w.balance_micro <> (select coalesce(sum(amount_micro), 0) from ledger_entries l where l.user_id = w.user_id)`;
    console.log(`Done: ${result.voided} event market(s) voided, demo ${result.seeded ? "written" : "not written"}. Wallets that disagree with the ledger: ${drift}.`);
  }
} finally {
  await client.end();
}
