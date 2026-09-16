import { defineConfig } from "drizzle-kit";

// Migrations run over the session pooler: Supabase's direct host is IPv6-only
// and does not resolve on this machine. See docs/TECH_STACK.md.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL ?? "" },
  strict: true,
});
