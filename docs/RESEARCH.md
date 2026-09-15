# Exploratory technical references

Status: research to support the product interview, **not approved architecture or product policy**. Reviewed on 2026-09-15 against the supplied 18-page master build prompt. No provider, market mechanism, ranking objective, scoring scheme, or verification standard is selected here. Relevant sections of the six primary sources below were actually opened and inspected; this is a bounded starting set, not an exhaustive review.

## 1. Automated market making and sparse participation

**Source:** Robin Hanson, *Logarithmic Market Scoring Rules for Modular Combinatorial Information Aggregation*, author-hosted January 2002 manuscript; see “Market Scoring Rules,” equation 6–7, and “Costs of Market Scoring Rules,” PDF pages 4–6. [Read manuscript](https://hanson.gmu.edu/mktscore.pdf).

**Finding:** A market scoring rule provides an automated trading counterparty. Logarithmic scoring produces exponential prices, with parameter `b` governing price responsiveness and subsidy. For fixed `b` and uniform initial probabilities across `n` mutually exclusive outcomes, the payout difference implies a worst-case subsidy of `b * ln(n)`; binary markets give `b * ln(2)`.

**Practical implication (inference):** LMSR merits comparison with an order book for sparse early activity: users can obtain quotes without a simultaneous opposing trader. Larger `b` reduces price movement per share while increasing the subsidy bound. Play-money issuance still affects price influence and incentives.

**Cannot infer:** Continuous quotes do not guarantee informative, calibrated, or manipulation-resistant prices. This source does not determine the right `b`, starting balances, position limits, or mechanism for this audience.

**Interview dependency:** Desired trading experience and acceptable price sensitivity before mechanism and liquidity settings.

## 2. Candidate generation versus ranking

**Source:** Covington, Adams, and Sargin, *Deep Neural Networks for YouTube Recommendations* (2016), Google-authored paper; section 2 and the discussion of offline versus live experiments, PDF page 2. [Read paper](https://research.google.com/pubs/archive/45530.pdf).

**Finding:** Candidate generation narrows a large corpus; ranking applies richer features to those candidates against an objective. The decomposition also permits multiple candidate sources. The paper notes that offline improvements do not always match live experiment results.

**Practical implication (inference):** The MVP can preserve separate candidate-source, eligibility, and ranking boundaries while using simple rules. This makes it possible to inspect whether unknown subjects were absent from the candidate pool or lost during ranking. It does not require neural networks.

**Cannot infer:** This is a published historical system description, not the current proprietary YouTube algorithm. Its watch-time objective, demographic inputs, scale, and neural models are not recommendations for this app.

**Interview dependency:** Define a successful feed session before selecting objectives, features, or experiment success criteria.

## 3. Exposure bias and the popularity feedback loop

**Source:** Schnabel et al., *Recommendations as Treatments: Debiasing Learning and Evaluation* (2016), sections 3 and 5, PDF pages 2–6. [Read author-hosted paper](https://www.cs.cornell.edu/~tj/publications/schnabel_etal_16b.pdf).

**Finding:** Observed interactions are selected by users and the recommendation policy. Evaluating only observed feedback can reverse comparisons between systems. Inverse-propensity methods can correct particular selection biases under their assumptions, but small observation probabilities create variance; inaccurate propensities add bias.

**Practical implication (inference):** Exposure and activity need separate measurements. If controlled exploration is chosen, log its actual assignment probability and policy version. Counts or engagement divided by impressions alone do not establish causal quality or eliminate position and selection effects.

**Cannot infer:** The paper does not prescribe an exploration percentage, guarantee fair discovery, or prove that inverse-propensity weighting is appropriate for a tiny MVP. Nonzero support and credible observation probabilities matter; a field named “propensity” is insufficient.

**Interview dependency:** Define discovery success and acceptable exploration tradeoffs before implementing distribution guarantees or debiasing.

## 4. Forecast scores and calibration

**Source:** Gneiting and Raftery, *Strictly Proper Scoring Rules, Prediction, and Estimation* (2007), introduction and section 3 examples, PDF pages 1 and 4–5. [Read author-hosted paper](https://sites.stat.washington.edu/people/raftery/Research/PDF/Gneiting2007jasa.pdf).

**Finding:** Strictly proper scoring rules make the reported belief uniquely optimal in expected score under the scoring setup. Brier and logarithmic scores are examples. Calibration concerns agreement between forecast probabilities and realized frequencies, while sharpness concerns concentration of predictions. Log scoring has unbounded penalties for assigning zero probability to an outcome that occurs.

**Practical implication (inference):** Compare binary Brier loss `(p - y)^2` with log loss before choosing reputation incentives. Record what forecast was made, when, and against which eventual resolution. Calibration needs a set of forecasts; one correct bet is insufficient.

**Cannot infer:** Trading profit is not a direct probability report. Properness does not settle leaderboard eligibility, forecast timing, correlated markets, sample sufficiency, or strategic market selection.

**Interview dependency:** Decide whether reputation rewards stated forecasts, trading skill, early discovery, or distinct measures.

## 5. Public API metrics have measurement semantics

**Source:** Official YouTube Data API `channels` resource, `statistics.subscriberCount`, `hiddenSubscriberCount`, and `viewCount`. [Read resource reference](https://developers.google.com/youtube/v3/docs/channels).

**Finding:** `subscriberCount` is rounded down to three significant figures. `hiddenSubscriberCount` indicates public visibility. The documented definition of views also has a dated change, illustrating that a metric's meaning can evolve.

**Practical implication (inference):** A subscriber milestone needs wording compatible with available precision and observation timing. An API observation should identify channel, metric, observation time, returned value, and relevant source semantics. Polling a current count does not establish the exact instant a threshold was crossed or prove it never crossed between polls.

**Cannot infer:** Public metrics alone do not verify the human subject's identity, account ownership, organic growth, or all statements made by the subject. No live integration, quota allowance, historical-data availability, or retention permission was tested here.

**Interview dependency:** Select initial claim types and acceptable evidence precision before committing to automated resolution.

## 6. Account ownership is a different verification claim

**Source:** Official YouTube Data API `channels.list`, `id`, `forHandle`, and authorized `mine` filters. [Read method reference](https://developers.google.com/youtube/v3/docs/channels/list).

**Finding:** The endpoint can look up channels by identifier or handle. Separately, an authorized request with `mine=true` returns channels owned by the authenticated user according to the API documentation.

**Practical implication (inference):** Keep “we observed this channel's metric” separate from “this connected account can establish a relationship to this channel.” A subject-to-channel link needs its own evidence and status; a public URL is insufficient. OAuth can contribute evidence of account control without proving every real-world identity or company claim.

**Cannot infer:** This method alone does not validate a person's legal identity, their authority to make all company claims, or exclusive control. OAuth scope selection, revocation, provider review requirements, retention, and account-management edge cases require implementation-specific research.

**Interview dependency:** Decide which claims actually require account control versus public-source checking or manual review.

## 7. Kalshi trading rules and launching markets without users

Added 2026-09-15 (Claude Code session) after the user asked to use Kalshi's rules and asked how Kalshi started with no users.

**Sources and how they were accessed:**
- Opened and read: CFTC Enforcement Division prediction markets advisory, 25 February 2026. [Press release](https://www.cftc.gov/PressRoom/PressReleases/9185-26).
- Opened and read: Kalshi Help Center, "Who are you trading with?" [Article](https://help.kalshi.com/en/articles/13823808-who-are-you-trading-with).
- Rule text quoted in search results, not read directly: Kalshi's [insider-trading page](https://kalshi.com/market-integrity/insider-trading) and the [KalshiEX rulebook filed with the CFTC](https://www.cftc.gov/filings/orgrules/rules07012525155.pdf). kalshi.com returned HTTP 429, and the rulebook PDF could not be text-extracted on this machine. Re-read the primary text before citing rule numbers.
- Title and date from search listings only: Kalshi's April 2024 announcement of its first dedicated institutional market maker, SIG ([Business Wire](https://www.businesswire.com/news/home/20240403664852/en/Kalshi-Onboards-Its-First-Dedicated-Institutional-Market-Maker); fetch returned 403).
- Secondary reporting, not opened: Kalshi Trading LLC as an affiliated market maker ([Sportico, 2025](https://www.sportico.com/business/sports-betting/2025/kalshi-trading-exchange-peer-house-1234870465/); [The American Prospect, August 2026](https://prospect.org/2026/08/26/house-always-wins-kalshi-prediction-markets/)); Polymarket's late-2022 move from an AMM to an order book; Manifold's [market mechanics post](https://news.manifold.markets/p/above-the-fold-market-mechanics).

**Findings:**
- Kalshi lists binary contracts priced between 1 and 99 cents that pay $1 for the correct outcome, matched on an order book. Traders must be 18+ and pass identity checks.
- Prohibited trading includes people with access to material non-public information, employees/affiliates of a contract's source agency, and anyone who is a decision maker or has any direct or indirect influence on the outcome, regardless of scale.
- The CFTC advisory's examples: a YouTube channel editor trading on unpublished content (misappropriated information) and a candidate trading on his own candidacy (influence over the outcome).
- Kalshi says customers always trade against another member, not the exchange. Liquidity came from market-maker members: reportedly an affiliate, then SIG from April 2024, plus incentive programs.
- Polymarket launched with an AMM and moved to an order book as volume grew. Manifold, a play-money platform, combines an AMM with limit orders, and subsidizing play-money liquidity has no cash cost.

**Practical implications (adopted by user decisions on 2026-09-15):** a small play-money community needs a counterparty that is always present; an app-run market maker provides what Kalshi's market makers provide without recruiting firms. Kalshi's influence ban maps directly to banning subjects and outcome decision-makers. Its non-public-information ban does not transfer cleanly: friends routinely know non-public things about each other, the ban cannot be enforced, and the product wants informed trading. The user chose a provisional friends-may-trade rule with per-market limits.

**Cannot infer:** Kalshi's regulatory obligations (identity checks, surveillance, CFTC oversight) neither apply to nor are satisfied by a play-money app; nothing here is legal advice. Liquidity at a regulated exchange says nothing about the right LMSR liquidity parameter for a small friend group.

## Research to schedule after the first decisions

- Collusion and related-party trading controls for small social groups (requested by the user on 2026-09-15): per-market limits, declared relationships and decision-makers, anomaly flags, after-the-fact cancellation and its accounting.
- Simulate LMSR price impact for candidate liquidity parameters against the agreed starting balance and per-market maximum.
- Check the selected provider's current permissions, quotas, terms, metric history, and revocation behavior before designing its integration.
- Define instrumentation and experiment questions around the chosen feed objective; then investigate exploration methods, position bias, and longer-term popularity feedback in more depth.
- Design the forecast sampling and resolution protocol before interpreting a leaderboard as evidence of skill.

All practical implications above are hypotheses for discussion. They do not override the question-first gates in the supplied specification.
