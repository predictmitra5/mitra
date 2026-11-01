import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/*
 * Server-only database client. Supabase's transaction pooler keeps no session
 * state, so prepared statements are disabled as its connection guide requires.
 * Never import this from a client component.
 *
 * Pipelining is off (max_pipeline 0, 2026-10-22). postgres.js otherwise sends
 * a further query down a connection before the last has finished, and through
 * the transaction pooler a batch that mixes a query without parameters with
 * parameterized ones (which go out in two halves) can then hang for good: the
 * owner's waiting count in the top bar hung in about a third of page loads.
 * Measured on the live database: 0 hangs in 48 calls with it off, 8 in 32
 * with it on. Queries still run side by side on up to five connections.
 *
 * Transactions get their own small pool that may pipeline (2026-11-01).
 * postgres.js reserves a connection for `sql.begin` only while a query may be
 * pipelined (connection.js, execute(): onexecute runs only while sent.length <
 * max_pipeline), so with max_pipeline 0 no transaction was ever reserved and
 * each failed with UNSAFE_TRANSACTION: from 2026-10-22 every market page said
 * it was unavailable. Transactions run their queries one after another, so
 * max_pipeline 1 there only lets begin reserve its connection.
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
  // max_pipeline is a postgres.js option its type definitions leave out, so it is passed in a variable.
  const options = { prepare: false, ssl: "require", max: 5, idle_timeout: 20, connect_timeout: 10, max_pipeline: 0 } as const;
  const client = postgres(connectionString, options);
  const transactionOptions = { ...options, max: 3, max_pipeline: 1 } as const;
  const transactions = postgres(connectionString, transactionOptions);
  drizzle(transactions, { schema }); // gives it drizzle's date parsers, as drizzle(client) does below
  client.begin = transactions.begin;
  database = drizzle(client, { schema });
  return database;
}

export { schema };
