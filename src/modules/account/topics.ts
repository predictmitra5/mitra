import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { bumpInterest } from "@/modules/recommend/events";
import { cleanTopics, type TopicKey } from "./topic-list";

/** What a picked topic is worth as a starting interest: about two liked videos. */
export const TOPIC_START_INTEREST = 4000;

/**
 * Stores the topics someone picked during onboarding (topic-list.ts) and, since
 * 2026-10-19, gives each a starting interest so a new member's feed leans that
 * way from the first visit. Watching soon outweighs it.
 */
export async function saveTopics<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string,
  values: readonly unknown[],
  now: Date = new Date(),
): Promise<TopicKey[]> {
  if (!isUuid(userId)) throw new Error("Invalid user.");
  const topics = cleanTopics(values);
  await database.update(schema.profiles).set({ topics }).where(eq(schema.profiles.id, userId));
  for (const topic of topics) await bumpInterest(database, `u:${userId}`, topic, TOPIC_START_INTEREST, now);
  return topics;
}
