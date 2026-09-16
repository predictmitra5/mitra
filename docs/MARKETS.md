# Markets

Status: creation, approval, trading eligibility, mechanism and economy decided and implemented as domain logic. Lifecycle, resolution and persistence are not decided or built.

## Confirmed direction - 2026-09-15

### Who creates and approves

In response to who initially creates/approves markets, the user answered: "at first me, but id be training you and youd have to copy my decison making abilties eventually".

Later the same day the user added: "imo my idea was to get the person to create the goal about themself. maybe we can do a hybrid, they input thier info and it generates goals but also allows them to make their own goals". They then chose both fill-in templates and AI-written suggestions.

Resulting flow: a subject creates a goal about themselves from a template, an AI suggestion based on what they enter, or their own wording. The owner approves each market before it is published and sets its opening price. The subject's own creation is the consent for that market. Proposals by other people about someone are not approved.

Owner approval standard: a goal must not be achievable simply by deciding to. The user: "its not like an on or off swithc where u can jsut achieve the goal with the desicicon in ur mind. this was the way to prevente insider trading".

Proposed learning workflow: preserve the information available for each case, the owner's ruling and concise reason, and any later correction; develop a versioned rule/example collection; compare AI recommendations with owner decisions on cases excluded from its examples. The initial owner authority remains while this is evaluated. Scope and performance requirements for later independent decisions require the owner's direction.

No AI reviewer, model training, decision dataset or automatic approval exists yet. AI goal suggestions help subjects draft goals; they do not approve markets.

### Who may trade

- Kalshi-style ban: a subject cannot trade markets about their own goals, and neither can other people who decide the outcome, such as a club's admission decision-makers. Implemented for buys and sells, since Kalshi prohibits entering any trade.
- Provisional, pending research the user requested: others may trade using what they know, subject to a per-person maximum per market. The owner may cancel trades of anyone found colluding with a subject. Cancellation accounting is not decided.
- Known gap: failing a goal is almost always a choice, so a subject can still collude with a friend holding NO.

How the app identifies people who decide an outcome (declared by the subject, set by the owner, reported by others) is not decided.

### Mechanism

After reviewing launch precedent (Kalshi's market-maker members, Polymarket's AMM-to-order-book transition, Manifold's play-money AMM; RESEARCH.md section 7), the user selected an app-run market-maker bot. Every trade executes immediately against it. Prices appear as cents per YES/NO share paying 1 point on the winning side. Limit orders may be added later.

Implementation: binary LMSR. Worst-case play-money subsidy is b ln 2 for a market opened at 50%, and -b ln(opening price of the winning side) otherwise (RESEARCH.md section 1). Manifold's CPMM was the main alternative.

## Economy

Decided 2026-09-15 and explicitly "subject to change". Values live in `src/modules/market/economy.ts`.

- Starting balance: 1,000 points.
- Refills: when the available balance is below 1,000, the user may tap Refill to restore it to 1,000, at most twice per calendar month in Eastern time. Confirmed 2026-09-15: only cash counts, so money in open positions does not block a refill and a trader's cash plus positions can exceed 1,000.
- Per-market maximum: 100 points per person, counting the cost basis of shares currently held on both sides. Selling releases cost basis at average cost and frees allowance.
- Selling: allowed back to the market maker while trading is open.
- Liquidity parameter b: 150 for new markets, so a 100-point bet moves a 50% market to 74%. The user asked for Kalshi's behavior and accepted this option; Kalshi's order book has no equivalent parameter.
- Opening price: the owner sets each market's opening probability when approving it.
- Unit: a winning share is worth 1 point (brief section 5), displayed Kalshi-style as 100¢, so a price of 62¢ means 0.62 points per share.

Still open: fees (none proposed), minimum trade size, rounding presentation, and whether a leaderboard ranks profit rather than balance given refills. Do not equate an available quote with reliable crowd consensus.

## User-provided goals and contract questions

The initial community is friends and Ohio State students. The user explicitly wants a broad range of goals. The examples below translate their ideas into questions for discussion and are candidates for the fill-in templates. No threshold, source, deadline or settlement rule is approved by these drafts.

| User example | Candidate wording pattern | What must become precise | Candidate proof to review |
| --- | --- | --- | --- |
| GPA | Will the person earn at least [GPA] for [semester/year]? | Semester versus cumulative GPA; official final versus provisional grades; end date and late grade changes | Redacted official grade report; a student's claim alone may not establish the result |
| Club admission | Will the person receive admission to [club] for [term]? | Admission offer versus accepting/joining; exact club and intake; deadline | Admission email or official membership confirmation, with irrelevant details removed |
| Internship | Will the person receive an internship offer from [company] by [date]? | Receiving versus accepting versus starting; qualifying role/term; contingencies | Redacted offer or employer confirmation; exact acceptance standard pending |
| Launch | Will the person launch [specified thing] by [date]? | What exists, who can access it, and what qualifies as a launch | Public release/working artifact or other agreed proof |
| Gym goal | Will the person perform [defined achievement] by [date]? | Measurable achievement, conditions, witnessing and timing | Agreed observation or evidence; video/witness features are discussion candidates, not approved upload capabilities |

Private student records or offer letters must not become public by default. Market pages are public and may be indexed by search engines, so define exactly what the reviewer needs and what a public outcome explanation reveals. Missing proof is not automatically NO; fallback and cancellation rules need agreement.

## Kalshi baseline

The user said: "Use kalshis rules for trading. id assume the peole being betted on have to be 18".

Adopted: binary YES/NO contracts shown in cents, and Kalshi's ban on trading by anyone who influences the outcome, applied to buys and sells. Subjects are expected to be 18+; how this is checked is undecided, and an Ohio State email does not establish it.

Not adopted: order-book matching (replaced by a market-maker bot) and a strict ban on trading with non-public knowledge (provisionally replaced by per-market limits). Play money only: no deposits, withdrawals, cash value or claim of regulatory compliance.

## Requirements from the brief

Source: sections 5, 6, 9, 10, 18 and 20, pages 5-6, 8 and 13-14.

- A binary YES contract pays one play-money unit if YES occurs and zero otherwise; NO is the complement.
- Persist ledger-style transactions and price history; do not rely only on mutable balances.
- Resolution must be deterministic and reproducible.
- Log market activity separately from recommendation exposure.
- Every market requires exact wording, close/resolution dates, YES/NO criteria, authoritative source hierarchy, fallback, dispute process, cancellation conditions and ambiguity procedure.
- False information does not automatically void a market.
- Routine approval, pause, resolution and review must have an admin interface.

## Lifecycle

Decided 2026-09-15. States: draft (subject created, awaiting the owner), rejected, open (approved and trading, at the owner's opening price), closed (no trading), ruled (owner has judged, 24-hour contest running), settled (paid out, final), cancelled (refunded).

- Trading closes automatically at the goal's deadline, and the owner may close a market early once the outcome is already public. Default close instant: 23:59 America/New_York on the deadline date, matching the refill month boundary. Assistant default, not separately confirmed.
- The subject has 7 days after the deadline to supply proof; the owner then rules.
- No proof by that deadline resolves NO. YES requires evidence, and the subject both wrote the goal and holds the proof. Known cost: a private person who truly succeeded loses, and NO holders gain from that silence. Revisit if it happens in the pilot.
- After the owner rules, anyone may contest for 24 hours and the owner may change the ruling. Payout follows and is final; points are never clawed back after settlement.
- Wording is frozen once trading opens. A broken market is cancelled and republished, never edited.
- If a subject deletes their account or withdraws, their open markets cancel immediately.
- Cancellation refunds each trader the cost basis of the shares they still hold; the market maker absorbs the difference. Cancellation is never silently treated as NO or as a 50% payout.

Still open: whether V1 is binary only (the PDF's race example needs separate rules); what counts as the event happening for each goal type (see the goal table above); evidence that surfaces after settlement; and whether any goal type needs a minimum or maximum duration.

## Engineering acceptance criteria after decisions

- Trades and settlement are atomic and safe under concurrent requests and retries.
- Replaying recorded ledger entries reproduces balances and the agreed position accounting.
- A retried trade or resolution cannot duplicate debits or payouts.
- Closed/paused/ineligible market behavior matches approved rules.
- The server rejects trades by a market's subject and recorded outcome decision-makers.
- The server enforces the per-market maximum under concurrent trades.
- Resolved prices and payouts can be explained using versioned terms, evidence, actors and timestamps.
- Quote validity, rounding and numeric precision are explicit and tested.

These criteria do not prescribe a database schema or specific concurrency technique.

## Implementation status (2026-09-15)

Implemented and unit-tested in `src/modules/market`, all pure logic with no persistence:

- `lmsr.ts`: price, cost function, buy cost, shares for a given spend, sell proceeds, opening state at a chosen probability, and the subsidy bound.
- `quote.ts`, `units.ts`: integer quotes in micro-points and micro-shares (1 point = 1,000,000 micro-points; a winning micro-share pays one micro-point). Rounding favours the market maker: shares round down, costs round up without exceeding the spend, sale proceeds round down.
- `position.ts`: holdings with average-cost basis per side, the amount currently in a market, and the remaining per-market allowance. Kept basis rounds up after a partial sale so rounding never frees extra allowance.
- `eligibility.ts`: the Kalshi-style ban on the subject and outcome decision-makers.
- `refill.ts`: refill eligibility and amount, with calendar months counted in Eastern time.
- `trade.ts`: `planBuy` and `planSell` apply the ban, the per-market limit, balance and share checks, and return the quote with the resulting position and balance.
- `economy.ts`: the owner's settings (1,000 start, two refills a month, 100-point limit, b = 150).

Tests (35) cover cost-function consistency, the identity that n YES plus n NO shares cost n points, spend/cost inversion, round trips that cannot make money, the subsidy bound, average-cost basis including values beyond 2^53, Eastern-time month boundaries, and every rejection path.

Not implemented: persistence, the ledger, price history, market lifecycle and status, resolution and payouts, cancellation accounting, concurrency control, and any user interface.

Price-impact simulation used to choose b, with markets opening at 50% (1,000 starting points, 100-point maximum):

| b | 10-point bet | 25-point bet | 100-point bet | 100-point bets to reach 90% | Maximum market-maker loss (points) |
| --- | --- | --- | --- | --- | --- |
| 50 | 59% | 70% | 93% | 1 | 35 |
| 100 | 55% | 61% | 82% | 2 | 69 |
| 150 | 53% | 58% | 74% | 3 | 104 |
| 200 | 52% | 56% | 70% | 4 | 139 |
| 300 | 52% | 54% | 64% | 5 | 208 |
| 500 | 51% | 52% | 59% | 9 | 347 |
