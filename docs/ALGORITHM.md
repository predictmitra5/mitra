# Discovery algorithm

Status: objective direction confirmed; no formula, features, weights or implementation approved.

## Confirmed objective - 2026-09-15

The user wants to maximize trades and also educate people making trades. Trade activity is the primary objective; information/education is an important supporting objective. Do not revert to discovery or trust as an independently selected primary objective.

Still discuss how to measure trades (completed trade count, participating traders or traded points), what education means in the experience, treatment of suspicious activity, repetition, and unknown-person discovery. No numerical weighting, trade-frequency prompts or friction removal are implied by this answer. The source's integrity constraints still apply.

## Requirements

Source: PDF sections 11-17, pages 8-12. Research public methods without claiming access to proprietary TikTok/YouTube algorithms. Establish measurement first. The feed must support discovering unknown people and avoid treating popularity alone as quality. The user has now selected trade activity as the main objective; scrolling time remains unselected.

The source proposes a staged pipeline: candidate generation, eligibility filtering, scoring, diversity reranking, exploration insertion, delivery and logging. This is a design frame; operational rules still need an interview.

## Decisions before ranking

- Define the confirmed trade objective precisely, the educational contribution, and trust/integrity constraints.
- Personalization inputs and their consent/privacy implications.
- Following/local-community content versus global/trending content.
- Deliberate discovery share and definition of an unknown/new subject.
- Exposure caps, test impressions, diversity and negative-feedback behavior.
- Handling verified, disputed, revoked, stale and self-reported updates.
- Whether freshness or information usefulness creates a boost, and how to avoid rewarding only positive news.
- Scaling, evidence thresholds and abuse controls for momentum/popularity features.

The PDF's additive scoring expression is conceptual. Do not implement it or assign numerical weights merely because it appears in the document.

## Measurement and feedback risks

The discovery engine must not directly write market prices. Attention still affects who trades, which can indirectly move prices and then influence attention again. Separate exposure logs, trade records and information events to inspect this loop.

Raw volume rewards heavily exposed subjects. Impression normalization needs actual viewed impressions, deduplication rules and minimum-evidence handling; dividing by tiny impression counts is not a complete fairness strategy. Proposed exploration methods need explicit choices and measurement.

## Versioning and experiments

Every eventual feed response must identify its algorithm version. Record meaningful feature/ranking changes here and in DECISIONS.md, along with hypothesis, objective, feature scaling, configuration, eligibility, exploration, assignment and observed results. No version is live yet.

Embeddings, collaborative filtering and bandits remain research/future candidates; sparse pilot data does not justify starting with an ML-heavy system. See RESEARCH.md for exploratory sources and ANALYTICS.md for the measurement prerequisites.

## The feed as built (2026-09-19, updated 2026-09-24)

Every open, approved goal gets a score, highest first:

- **Interest** over the last 24 hours: `log10(1 + clicks + 5 × trades + 3 × distinct traders)`. The logarithm keeps one runaway goal from burying the rest.
- **A head start for new goals**: plus 1.0 at approval, fading to nothing over 48 hours.
- **Urgency**: times 1.5 when the trading deadline is within 72 hours.
- **Decay**: the total divided by `(hours since approval + 2)^1.5`, so goals sink unless people keep trading them.
- **Diversity**: no person holds more than 2 of the top 10 slots, best effort when there are too few people.

Everyone sees the same order; nothing is personalized, and `feed_events` carries no viewer identity. The featured carousel prefers traded goals, in rank order.

Since 2026-09-24: banned and withdrawn people's goals are excluded. There is **no boost for having a profile photo**: the owner asked about one, and accepted the recommendation that it is unnecessary once a photo is required to post a goal. Live price polling records no events, so it cannot move the ranking.
