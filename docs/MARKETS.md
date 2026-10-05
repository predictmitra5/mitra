# Markets

Status: goal drafting, owner approval, the public feed and market pages, transactional buy/sell execution, the private positions page, close, ruling/revision, private objections, final payouts, cancellation refunds, monthly cash refills, and proof submission with owner-published statements are built. Account withdrawal and deployed background scheduling remain to be implemented.

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
- Refills: when the available balance is below 1,000, the user may tap Refill to restore it to 1,000, at most twice per calendar month in Eastern time. Confirmed 2026-09-15: only cash counts, so money in open positions does not block a refill and a trader's cash plus positions can exceed 1,000. Built 2026-09-18 in `src/modules/account/refill.ts`: the wallet row is locked before the amount and the monthly quota are recomputed, the credit and its ledger entry commit together, and the ledger row id doubles as the request id so a retry returns the original receipt rather than crediting twice.
- Per-market maximum: 100 points per person, counting the cost basis of shares currently held on both sides. Selling releases cost basis at average cost and frees allowance.
- Selling: allowed back to the market maker while trading is open.
- Liquidity parameter b: 150 for new markets, so a 100-point bet moves a 50% market to 74%. The user asked for Kalshi's behavior and accepted this option; Kalshi's order book has no equivalent parameter.
- Opening price: the owner sets each market's opening probability when approving it.
- Unit: a winning share is worth 1 point (brief section 5), displayed Kalshi-style as 100¢, so a price of 62¢ means 0.62 points per share.

Still open: fees (none proposed), minimum trade size, rounding presentation, and whether a leaderboard ranks profit rather than balance given refills. Do not equate an available quote with reliable crowd consensus.

## User-provided goals and contract questions

The initial community is friends and students in the OSU and UIUC editions. The user explicitly wants a broad range of goals. Templates for GPA, club, internship and gym goals were decided on 2026-09-16, and a Running template on 2026-09-24. Launch and music goals have no template yet and use the subject's own wording; the owner plans a music template later. Each template also sets the goal's tab on the feed (Grades, Clubs, Internships, Gym, Running); goals in the subject's own words appear under Anything.

| Goal type | Template wording | What counts as YES | Proof the owner reviews |
| --- | --- | --- | --- |
| GPA | Will [name] earn at least [GPA] for [semester]? | That semester's GPA once final grades post on the official record. The deadline is the grade-posting date | The official grade report |
| Club admission | Will [name] be offered admission to [club] by [date]? | Receiving the club's admission offer before the deadline, whether or not they join | The admission message |
| Internship | Will [name] receive a written internship offer from [company] by [date]? | A written offer dated before the deadline, even if declined | The offer email or letter |
| Gym | Will [name] [achievement] by [date]? | One uncut video of the achievement, posted publicly before the deadline | A public Instagram, TikTok or YouTube link; the app stores no video |
| Running | Will [name] run [a 5K / a 10K / a half marathon / a marathon / an N-mile race] [in under a target time] by [date]? | Finishing a race of that distance on or before the deadline, under the target time if one is set. Chip time counts when the results list it, otherwise the official finish time. A run logged only in an app or on a watch does not count | A link to the race's official published results page |
| Launch | No template yet | Not decided: what exists, who can access it, what qualifies as launched | Judged from the subject's own wording at approval |

Private student records or offer letters must not become public by default. Market pages are public and may be indexed by search engines, so define exactly what the reviewer needs and what a public outcome explanation reveals. Missing proof by the evidence deadline resolves NO; see Lifecycle below.

## Kalshi baseline

The user said: "Use kalshis rules for trading. id assume the peole being betted on have to be 18".

Adopted: binary YES/NO contracts shown in cents, and Kalshi's ban on trading by anyone who influences the outcome, applied to buys and sells. All participants explicitly confirm they are 18 or older at profile setup (decided 2026-09-16); a university email does not establish age.

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
- Decided 2026-09-18: a changed ruling starts a fresh full 24-hour window. Ruling explanations are public; objections are visible only to their author and the owner. Objections themselves do not extend the cutoff.
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

## Implementation status (updated 2026-09-23)

Implemented and unit-tested pure logic in `src/modules/market`:

- `lmsr.ts`: price, cost function, buy cost, shares for a given spend, sell proceeds, opening state at a chosen probability, and the subsidy bound.
- `quote.ts`, `units.ts`: integer quotes in micro-points and micro-shares (1 point = 1,000,000 micro-points; a winning micro-share pays one micro-point). Rounding favours the market maker: shares round down, costs round up without exceeding the spend, sale proceeds round down.
- `position.ts`: holdings with average-cost basis per side, the amount currently in a market, and the remaining per-market allowance. Kept basis rounds up after a partial sale so rounding never frees extra allowance.
- `eligibility.ts`: the Kalshi-style ban on the subject and outcome decision-makers.
- `refill.ts`: refill eligibility and amount, with calendar months counted in Eastern time.
- `trade.ts`: `planBuy` and `planSell` apply the ban, the per-market limit, balance and share checks, and return the quote with the resulting position and balance.
- `economy.ts`: the owner's settings (1,000 start, two refills a month, 100-point limit, b = 150).

Account refill persistence and controls are implemented in `src/modules/account` and `/account`. Additional validation on 2026-09-19 covers exact micro-point credits, Eastern year/month and daylight-saving boundaries, retry receipts after later spending/month changes, missing wallets, stale eligibility, rollback, authenticated action errors, and hosted concurrency with trades and payouts. The committed original refill tests are preserved alongside the added `refill-safety.test.ts` cases. A real signed-in walkthrough has still not been done; email confirmation is switched off for the pilot, so it no longer waits on email setup.

`/positions` (`src/modules/account/positions.ts`) lists only the signed-in active adult's own nonzero holdings in approved open, closed or ruled markets. The owner gets no view of anyone else's. Holdings are listed soonest deadline first, in pages of 20, with shares and held cost at the engine's six-decimal precision. Since 2026-09-24 each row shows the person's photo, the side, shares and average price paid, and the holding's value at the current public price with the gain or loss since bought (`valueHolding`): a YES share is valued at the YES price, a NO share at one minus it. That value is not what selling would return, which is lower for a large holding because a sale moves the price, and the page says so. The account page shows the first page and the total value and gain across all holdings. Nothing ranks anybody. Status labels distinguish trading open, trading closed, an open objection window and a pending payout. Sold, settled and refunded holdings leave the list, and an empty list links to the public feed. The count and rows are read in one repeatable-read snapshot, after due closes and payouts are processed.

Tests (35) cover cost-function consistency, the identity that n YES plus n NO shares cost n points, spend/cost inversion, round trips that cannot make money, the subsidy bound, average-cost basis including values beyond 2^53, Eastern-time month boundaries, and every rejection path.

`service.ts` and `actions.ts` now wrap that logic in database transactions and freshly verified OSU authorization. They enforce active adult-confirmed accounts, approval/open status, the trading deadline, subject and recorded-decider exclusions, available cash/shares and the held-cost limit. Trade, ledger, wallet, position, market state and price point commit or roll back together. Migration 0004 preserves the original request amount for exact retries. Four hosted concurrency scenarios exercise repeated confirmations, competing traders, a shared wallet across markets and a deadline reached while a request waits on a database lock.

`/markets/[id]` displays public approved terms, prices, subject display name/handle and deadlines. The account's approved-goal entries link to it. Eligible traders see their holdings and can preview a buy in points or a sale in shares, then explicitly confirm it. The server recomputes every quote. If the market's share state changed, confirmation fails and requires a new preview; the app never silently changes the price. Retries retain the same request id after an interrupted response. The existing six-decimal engine precision is shown for totals and holdings; marginal prices and average per-share prices are displayed to two decimal places in cents. A zero-proceeds micro-sale is explicitly identified before confirmation. No fee or new product minimum was introduced. Since 2026-09-24 the trade panel first shows an estimate (`estimate.ts`): in a binary LMSR a trade's cost depends only on the current price and the liquidity, so the panel prices the shares, average price and "To win" (the payout if that side wins) exactly, price impact included, from the public price and b, without the private share counts. Quick amounts add 10 or 25 points; Max is the smaller of available cash and what is left of the 100-point limit, or the shares held when selling. The server's preview is still the figure a trader confirms.

`lifecycle.ts`, `lifecycle-actions.ts` and `/review/markets` now implement deadline closure, owner early close after confirmation that the outcome is public, first rulings after the seven-day proof period, ruling changes, private objections, final settlement and owner cancellation/refunds. Commands carry retry keys and the version the owner reviewed. A changed ruling increments the version and starts another full 24 hours; stale forms and late objections fail. At the cutoff, changes and cancellation are refused even if payout processing has not yet run. Objections do not suspend finalization on their own. A missing-proof ruling must be explicitly recorded as NO by the owner; no upload-absence inference is made.

Settlement pays one micro-point per winning micro-share and records zero payouts for losing positions. Cancellation returns the sum of held cost basis on both sides, including the effect of earlier partial sales. Each operation locks the market and participant wallets, appends ledger/audit records, clears active positions and sets the terminal status in one transaction. Retry or racing calls cannot credit twice. Historical market-maker shares are kept as the last trading state; settled pages separately show the final outcome, and cancellation pages show refunds rather than an outcome payout.

Due transitions run on access to market, account, positions and owner-management pages, with bounded batches for account, positions and owner reads. No deployed periodic runner exists yet, so unattended markets may retain their old stored status and unprocessed payouts until accessed. Trading and objection deadline checks still apply at their exact cutoff. Account withdrawal/deletion, automatic cancellation on withdrawal, selective collusion-trade reversal and outcome-decider assignment remain unfinished. Since 2026-09-24 a ban cancels the banned person's open goals, and closed goals not yet ruled, through the owner's own cancel command, so traders are refunded at held cost exactly as in any cancellation; ruled goals finish normally, and their bets on others' goals settle normally. The public feed and proof submission are built separately; see ALGORITHM.md and VERIFICATION.md. Every page, signed-in ones included, has been checked in a browser at desktop and 375px against fictional data (`scripts/preview-signed-in.mjs` for signed-in pages); no real account has walked the flow end to end.

Price-impact simulation used to choose b, with markets opening at 50% (1,000 starting points, 100-point maximum):

| b | 10-point bet | 25-point bet | 100-point bet | 100-point bets to reach 90% | Maximum market-maker loss (points) |
| --- | --- | --- | --- | --- | --- |
| 50 | 59% | 70% | 93% | 1 | 35 |
| 100 | 55% | 61% | 82% | 2 | 69 |
| 150 | 53% | 58% | 74% | 3 | 104 |
| 200 | 52% | 56% | 70% | 4 | 139 |
| 300 | 52% | 54% | 64% | 5 | 208 |
| 500 | 51% | 52% | 59% | 9 | 347 |
