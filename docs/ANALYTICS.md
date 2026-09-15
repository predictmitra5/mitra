# Analytics and experiments

Status: event candidates and measurement questions; no analytics provider, schema or retention chosen.

Confirmed objective on 2026-09-15: maximize trades, with education/informed trading also important. Define completed trade count versus traded points/participation and an appropriate measure of information use before implementing optimization. No weights or success thresholds are approved.

## Source requirements

PDF sections 16-17, pages 11-12: instrumentation must precede sophisticated ranking. Relevant context includes user/session, market/subject, timestamp, feed position, reason, algorithm version and experiment assignment where appropriate. Do not collect unnecessary sensitive information.

## Candidate event families

| Family | Examples from the brief | Definition still needed |
| --- | --- | --- |
| Exposure | feed_impression, market_impression | Visible fraction, duration, repeat/deduplication semantics |
| Investigation | market_open, profile_open, update_view, update_expand, update_source_open | Meaningful source consumption versus accidental opens |
| Trading | trade_started, trade_completed, yes_trade, no_trade | Authoritative server success versus client intent; retries |
| Interest | market_follow, subject_follow, share, comment | Only for approved product features |
| Negative feedback | hide, not_interested, report, scroll_next | Explicit dissatisfaction versus normal navigation |
| Information operations | verification_submit, verification_approved, verification_rejected | Reviewer context without raw private evidence |
| Market operations | market_created, market_resolved | Approved lifecycle and outcome version |

Do not collect all candidate events automatically. Agree the minimum set tied to actual MVP features, the retention policy, and the purpose of each field.

## Important measurement distinctions

- Delivering a feed response is not proof that each returned card was seen.
- Client trade intent is not a completed ledger transaction.
- Increased trading after an update is correlation unless an appropriate design establishes an effect.
- A user's trade direction or position is not automatically their stated outcome probability.
- A market probability history can be scored separately from individual forecaster skill.
- Engagement with a famous subject does not demonstrate discovery of an unknown one.

## Candidate outcomes

The source suggests D1/D7 retention, sessions, trades, views, discovery, follows, verified updates, conversion, revisits, calibration, and new-subject exposure share. Define one main pilot outcome and trust constraints with the user before weighting or optimizing them.

For future Brier/log scoring, decide what probability is recorded, when it is eligible, which resolved events count and how multiple forecasts are aggregated. The leaderboard may wait, but its necessary data protocol cannot be recovered retroactively.

## Acceptance criteria after decisions

- Exposure, source consumption and server-confirmed transactions remain separately attributable.
- Duplicate retries do not inflate authoritative action counts.
- Every feed response has a version; impressions can reference the served context.
- No private evidence text, provider tokens or unnecessary sensitive data enters analytics.
- Experiment assignment and population definitions are reproducible; no experiment runs before its objective and guardrails are approved.
