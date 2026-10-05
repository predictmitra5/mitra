import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { cleanTopics, type TopicKey } from "./topic-list";

/** Stores the topics someone picked during onboarding. See topic-list.ts. */
export async function saveTopics<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string,
  values: readonly unknown[],
): Promise<TopicKey[]> {
  if (!isUuid(userId)) throw new Error("Invalid user.");
  const topics = cleanTopics(values);
  await database.update(schema.profiles).set({ topics }).where(eq(schema.profiles.id, userId));
  return topics;
}
