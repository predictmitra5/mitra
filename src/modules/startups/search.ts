import { and, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { readCards, type FeedCard } from "@/modules/discovery/feed";
import { INDUSTRIES } from "./labels";
import { readVideoCards, type VideoCardModel } from "./read";

/*
 * Search (2026-10-19): startups, founders, industries, markets and videos.
 * Every word of the query must appear somewhere in a result's own words
 * (name, tagline, description, tags; a founder's name, handle, headline and
 * bio; a market's question; a video's title). A word naming an industry
 * ("AI", "#EdTech", "developer tools") also matches that industry. Approved
 * records only. Plain ILIKE is enough at this size; a search index can
 * replace it later without changing callers.
 */

const { startups, founders, markets, videos, startupFounders } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export const SEARCH_LIMIT = 24;

/** The query's words: lower case, no leading #, no LIKE wildcards, at most eight. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).map((w) => w.replace(/^#/, "").replace(/[%_\\]/g, "")).filter((w) => w.length > 0).slice(0, 8);
}

/** Industries a query names, by key or label ("ai", "EdTech", "developer tools"). */
export function industriesIn(query: string): string[] {
  const text = ` ${query.toLowerCase().replace(/#/g, "")} `;
  return INDUSTRIES.filter((entry) => entry.key !== "other" && (text.includes(` ${entry.key} `) || text.includes(` ${entry.label.toLowerCase()} `) || text.includes(` ${entry.tag.toLowerCase()} `))).map((entry) => entry.key);
}

function everyWord(words: string[], text: SQL): SQL | undefined {
  return and(...words.map((word) => ilike(text, `%${word}%`)));
}

export type SearchResults = {
  query: string;
  industries: string[];
  startups: (typeof startups.$inferSelect)[];
  founders: { id: string; handle: string; name: string; headline: string; hue: number; portraitUrl: string | null; startupName: string | null }[];
  markets: FeedCard[];
  videos: VideoCardModel[];
};

export async function searchAll<Q extends PgQueryResultHKT>(database: Database<Q>, query: string, viewerUserId: string | null, now: Date = new Date()): Promise<SearchResults> {
  const words = searchWords(query);
  const industries = industriesIn(query);
  const empty: SearchResults = { query, industries, startups: [], founders: [], markets: [], videos: [] };
  if (!words.length) return empty;
  type Industry = (typeof startups.industry.enumValues)[number];
  const byIndustry = industries.length ? inArray(startups.industry, industries as Industry[]) : undefined;

  const startupText = sql`concat_ws(' ', ${startups.name}, ${startups.tagline}, ${startups.headline}, ${startups.description}, ${startups.productDetails}, array_to_string(${startups.tags}, ' '), ${startups.industry}::text)`;
  const startupRows = await database.select().from(startups)
    .where(and(eq(startups.status, "approved"), or(everyWord(words, startupText), byIndustry)))
    .orderBy(desc(startups.approvedAt)).limit(SEARCH_LIMIT);

  const founderText = sql`concat_ws(' ', ${founders.name}, ${founders.handle}, ${founders.headline}, ${founders.bio}, ${founders.background})`;
  const founderRows = await database.selectDistinctOn([founders.id], {
    id: founders.id, handle: founders.handle, name: founders.name, headline: founders.headline, hue: founders.hue, portraitUrl: founders.portraitUrl, startupName: startups.name,
  }).from(founders).leftJoin(startupFounders, eq(startupFounders.founderId, founders.id))
    // Only approved startups are joined, so a pending or suspended one never names a founder in results.
    .leftJoin(startups, and(eq(startups.id, startupFounders.startupId), eq(startups.status, "approved")))
    .where(and(eq(founders.status, "approved"), or(everyWord(words, founderText), byIndustry && and(byIndustry, eq(startups.status, "approved")))))
    .orderBy(founders.id, sql`${startups.name} is null`).limit(SEARCH_LIMIT);

  const marketText = sql`concat_ws(' ', ${markets.question}, ${markets.shortQuestion}, ${startups.name}, ${startups.industry}::text)`;
  const marketIds = (await database.select({ id: markets.id }).from(markets).innerJoin(startups, eq(startups.id, markets.startupId))
    .where(and(isNotNull(markets.approvedAt), eq(startups.status, "approved"), inArray(markets.status, ["open", "closed", "ruled", "settled"]), or(everyWord(words, marketText), byIndustry)))
    .orderBy(sql`case when ${markets.status} = 'open' then 0 else 1 end`, markets.deadlineAt).limit(SEARCH_LIMIT)).map((r) => r.id);

  const videoText = sql`concat_ws(' ', ${videos.title}, ${videos.description}, ${startups.name}, ${startups.industry}::text)`;
  const videoIds = (await database.select({ id: videos.id }).from(videos).innerJoin(startups, eq(startups.id, videos.startupId))
    .where(and(eq(videos.status, "approved"), eq(startups.status, "approved"), or(everyWord(words, videoText), byIndustry)))
    .orderBy(desc(videos.publishedAt)).limit(12)).map((r) => r.id);

  return {
    query, industries,
    startups: startupRows,
    founders: founderRows,
    markets: await readCards(database, marketIds, now),
    videos: await readVideoCards(database, videoIds, viewerUserId, now),
  };
}
