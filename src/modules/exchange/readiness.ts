/** This deployment has no verified operating arrangement or settled-funds adapter.
 * Opening execution requires a reviewed implementation of both; no environment
 * flag, owner button, webhook or client callback can enable it. */
export const readiness = Object.freeze({ deposits: false, withdrawals: false, execution: false, currency: "USD", reason: "Trading is not available yet. Account funding is closed." });
export function requireExecutionAuthorization(): never { throw new Error(readiness.reason); }
export function fundingUnavailable() { return Response.json({ code: "FUNDING_CLOSED", error: "Deposits and withdrawals are not available." }, { status: 409, headers: { "Cache-Control": "no-store" } }); }
