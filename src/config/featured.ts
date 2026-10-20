/**
 * The market the owner pinned to the top of the home page (DECISIONS.md,
 * 2026-10-10): the Midway on High sample. While it is open in the feed being
 * read it is the featured market; once it closes, or with null here, the
 * featured market is again the one moving most today. Changing the pick is a
 * one-line change and a deploy, with nothing to migrate.
 */
// The Midway pin ended with the event markets on 2026-10-19: nothing is pinned.
export const PINNED_FEATURED_MARKET_ID: string | null = null;
