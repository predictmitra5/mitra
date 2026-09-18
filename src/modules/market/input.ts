/** Exact decimal conversion. Never silently round a user's trade amount. */
export function parseTradeAmount(value: unknown): number | null {
  if (typeof value !== "string" || value.length > 30) return null;
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const micro = BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
  if (micro <= BigInt(0) || micro > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(micro);
}

/** All six decimal places are available so a trader can sell their entire holding. */
export function formatMicro(value: number): string {
  return (value / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}
