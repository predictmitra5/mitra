// Local presentation check only. No database, Auth users, cookies or credentials.
// Run after npm run build; stop with Ctrl+C or "stop" on interactive stdin.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const project = process.cwd();
const output = await build({
  entryPoints: [resolve(project, "src/app/positions/positions-view.tsx")], bundle: true, write: false,
  format: "cjs", platform: "node", jsx: "automatic", packages: "external", alias: { "@": resolve(project, "src") },
  logLevel: "silent", plugins: [{ name: "static-preview-links", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "preview" }));
    builder.onLoad({ filter: /.*/, namespace: "preview" }, () => ({
      contents: 'import React from "react"; export default function Link({href, children, className}) { return React.createElement("a", {href, className}, children); }',
      resolveDir: project,
    }));
  } }],
});
const compiled = { exports: {} };
// Execute only the component compiled above from this repository.
new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { PositionsView } = compiled.exports;
const staticDirectory = join(project, ".next/static");
const cssFiles = (await readdir(staticDirectory, { recursive: true })).filter((file) => file.endsWith(".css"));
if (!cssFiles.length) throw new Error("Run npm run build before starting the positions preview.");
const css = (await Promise.all(cssFiles.map((file) => readFile(join(staticDirectory, file), "utf8")))).join("\n");

const common = {
  evidenceDeadlineAt: new Date("2026-10-08T03:59:00Z"), contestEndsAt: null, ruledOutcome: null,
  contestOpen: false, status: "open", tradingOpen: true, yesSharesMicro: 0, noSharesMicro: 0,
  yesCostBasisMicro: 0, noCostBasisMicro: 0,
};
const goals = [
  { ...common, marketId: "fixture-club", question: "Will Maya receive an admission offer from the Ohio State robotics club?",
    displayName: "Maya Chen", handle: "maya_builds", deadlineAt: new Date("2026-10-01T03:59:00Z"),
    yesSharesMicro: 26_345_678, yesCostBasisMicro: 15_123_456, noSharesMicro: 8_765_432, noCostBasisMicro: 4_567_890 },
  { ...common, marketId: "fixture-internship", question: "Will Jordan receive a written internship offer from Example Company by November 1?",
    displayName: "Jordan Patel", handle: "jordan_p", deadlineAt: new Date("2026-11-02T04:59:00Z"),
    evidenceDeadlineAt: new Date("2026-11-09T04:59:00Z"), status: "closed", tradingOpen: false, noSharesMicro: 99_999_999, noCostBasisMicro: 53_123_456 },
  { ...common, marketId: "fixture-gym", question: "Will Sam complete a 225-pound bench press with an uncut public video before the goal deadline?",
    displayName: "Sam Rivera", handle: "sam_r", deadlineAt: new Date("2026-11-10T04:59:00Z"),
    status: "ruled", tradingOpen: false, contestOpen: true, ruledOutcome: "yes", contestEndsAt: new Date("2026-11-18T16:00:00Z"),
    yesSharesMicro: 1, yesCostBasisMicro: 1 },
];

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3110");
  response.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/styles.css") {
    response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" }); response.end(css); return;
  }
  if (!["/", "/positions", "/empty", "/pending"].includes(url.pathname)) { response.writeHead(404); response.end("Preview route not found."); return; }
  const empty = url.pathname === "/empty", pending = url.pathname === "/pending";
  const data = { total: empty ? 0 : 43, page: Math.min(3, Math.max(1, Number(url.searchParams.get("page")) || 1)), pages: empty ? 1 : 3,
    goals: empty ? [] : pending ? [{ ...goals[2], contestOpen: false }] : goals };
  const view = renderToStaticMarkup(React.createElement(PositionsView, { data }));
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Positions presentation preview · Mitra</title><link rel="stylesheet" href="/styles.css"></head><body><div class="site-shell"><header class="app-header"><a class="wordmark" href="/"><span class="brand-mark">↗</span>Mitra</a><span class="access-label">OHIO STATE <span> / EARLY ACCESS</span></span></header><main class="account-main positions-main"><nav class="market-nav"><span>Fictional local preview</span><a href="/">Holdings</a><a href="/empty">Empty</a><a href="/pending">Pending payout</a></nav>${view}</main><footer class="app-footer"><span>Play money. Real goals.</span><span>No deposits. No cash value.</span></footer></div></body></html>`);
});
server.listen(3110, "127.0.0.1", () => console.log("Fictional positions preview: http://127.0.0.1:3110 (also /empty and /pending). Type stop to close."));
function stop() { server.close(() => process.exit(0)); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (value) => { if (value.trim() === "stop") stop(); });
