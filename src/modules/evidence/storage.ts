/*
 * The private bucket that held proof originals for goal markets (2026-09-19).
 * Proof uploads were retired with goal markets on 2026-10-08: event markets are
 * settled by the owner from each market's named source. The bucket stays
 * private and stays in account deletion, so any original from before the pivot
 * is still removed when its sender deletes their account.
 */

export const ORIGINALS_BUCKET = "evidence-originals";
