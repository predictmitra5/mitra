import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/*
 * Server-only database client. Supabase's transaction pooler keeps no session
 * state, so prepared statements are disabled as its connection guide requires.
 * Never import this from a client component.
 */
let database: PostgresJsDatabase<typeof schema> | undefined;

type DatabaseEnvironment = {
  [key: string]: string | undefined;
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
};

export function resolveDatabaseConnectionString(
  environment: DatabaseEnvironment = process.env,
) {
  const connectionString = environment.DATABASE_URL || environment.POSTGRES_URL;
  if (!connectionString) throw new Error("Database is not configured.");
  return connectionString;
}

export function getDb() {
  if (database) return database;
  const connectionString = resolveDatabaseConnectionString();
  const client = postgres(connectionString, {
    prepare: false, ssl: "require", max: 5, idle_timeout: 20, connect_timeout: 10,
  });
  database = drizzle(client, { schema });
  return database;
}

export { schema };
