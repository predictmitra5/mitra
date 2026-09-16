import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/*
 * Server-only database client. Supabase's transaction pooler keeps no session
 * state, so prepared statements are disabled as its connection guide requires.
 * Never import this from a client component.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

const client = postgres(connectionString, { prepare: false, ssl: "require" });

export const db = drizzle(client, { schema });
export { schema };
