# Product

> **2026-10-19: pivot to founder videos and startup markets.** Mitra is a video-first place to discover early founders and their startups, with Yes/No markets on measurable startup milestones traded with Trade Coins. A viewer watches a founder's video, learns about the startup, reads its market's price history, takes a position and follows the founder. Three systems stay separate: discovery (the personalised feed), information (profiles, videos, updates, verification) and prediction (markets). What follows about events and goals describes earlier versions. See DECISIONS.md, 2026-10-19, and MARKETS.md, Startup markets.

> **2026-10-12: current implementation direction.** Mitra is a campus event-market prototype. New accounts and retained owner accounts start with zero Gold Trade Coins. The app has separate Silver Coin balances and badge offers, but purchases fail closed until a payment provider is connected; no money is accepted. Owners can configure location-checked campus QR campaigns for free Gold awards. Signed-out visitors can choose OSU or UIUC to browse; they cannot trade. These mechanics do not establish legal compliance or a safe harbor. See DECISIONS.md and MARKETS.md.

> **2026-10-08: pivot to campus event markets.** Markets are now about what happens at venues and events on a campus, launching at Ohio State, not about people's goals. Students suggest markets; the owner publishes them with exact terms and a named source. What follows about goals describes the product before the pivot. See DECISIONS.md, 2026-10-08, and MARKETS.md, Event markets.

Status: participation rules, accounts, economy, market lifecycle and goal templates are confirmed; verification, discovery and the final MVP screens remain open.

## Source-grounded concept

The app originally let users forecast people's goals using points. This is historical concept context only; the 2026-10-08 pivot replaced goal markets with campus events. See MARKETS.md.

## Confirmed user direction - 2026-09-15

- First communities: the user's friends and students joining through the OSU and UIUC editions. Sign-in requires a verified `@osu.edu` or `@illinois.edu` identity, widening after product-market fit.
- Goal categories are broad. The user supplied GPA by semester/year end, club admission, an internship at a named company, launching something, and a gym goal. These are examples, not a closed category list.
- Main objective: maximize trades. Education and informed trading are also important.
- People create goals about themselves: from fill-in templates, from AI-written suggestions based on what they enter, or in their own words. The owner approves every market before it is published. The user wants an AI reviewer to eventually follow their judgment.
- Nobody trades a market about their own goal, and neither do people who decide its outcome (Kalshi-style). The owner does not approve goals that can be achieved simply by deciding to.
- Trades execute against an app-run market-maker bot, so a trade never waits for another person. Prices appear Kalshi-style in cents.
- Provisionally, friends may trade using what they know, with a per-person maximum per market. The user asked for more research on collusion.
- Since 2026-10-05 anyone can browse the feed, goal pages, live prices and profile photos; trading, posting and every other write need a verified signed-in account. Visitors get a closable sign-up pop-up after 30 seconds, reopened by Yes, No or trade controls. Search engines are asked not to index goal pages.
- Sign-in at launch requires a verified OSU or UIUC email address. This excludes friends outside those campuses and does not establish anyone's age.
- The owner sets each market's opening price when approving it.
- Current economy (2026-10-12): Gold Trade Coins are nonredeemable market collateral; new accounts start at zero. Silver Coins are separate and used only for disclosed badge offers. The purchase UI is a nonfunctional placeholder until payment processing is connected; it cannot create an order or award either currency. Free campaign awards are owner-configured and location checked. No withdrawals or cash/prize redemption exist.
- Public sources and private documents are acceptable evidence categories for initial owner review; actual sufficiency/privacy rules remain open.

Market probabilities describe a particular outcome by a particular time. They must not become a general measure of a person's worth. Trading, verification, and attention allocation have separate roles.

## Users to distinguish

- Forecaster: reads claims and rules, predicts or trades, follows progress, and inspects results.
- Subject: creates goals about themselves, provides updates and proof, and cannot trade their own markets.
- Reviewer/admin: approves goals and reviews evidence, outcomes, disputes, and reports through an operational interface.

One person may occupy multiple roles. A subject is a forecaster on other people's markets; other permitted combinations and conflicts of interest remain open.

## Scope already established by the brief

- Play money without cash conversion, deposits, withdrawals, or cash prizes.
- Mobile-first web experience; native mobile deferred unless explicitly requested.
- Goals need sufficiently clear outcome criteria to resolve; the user's broad-goal direction supersedes the original professional/creative focus. The PDF's harmful/humiliating-market and protected-characteristic boundaries remain relevant; broad scope is not treated as an explicit instruction to remove them.
- Auditability, provenance, event logging, persistent documentation, and unknown-subject discovery are core requirements.
- No real-money subject compensation in V1.

Everyone with an account confirms they are 18 or older at profile setup, so both subjects and traders are covered. This is self-attestation, not verification (decided 2026-09-16). A person creating their own goal is the consent for that market. No public-figure exception has been approved.

## Candidate experience, not an approved screen list

The source proposes onboarding, feed, market detail, profile, portfolio, leaderboard, search, market proposal, updates, verification submission, admin review/resolution, settings, and notifications. Prioritize them with the user. Goal creation (templates plus AI suggestions) and the owner approval queue are now required by confirmed decisions. Consumer/social presentation is requested, but swipe behavior, card density, comments, visible scores, and quick-trade mechanics are undecided.

## Validation hypotheses

1. People enjoy predicting these outcomes and voluntarily return.
2. Subjects provide truthful, fresh information, including unfavorable news.
3. Verified information increases trust or useful forecasting activity.
4. Unknown subjects receive meaningful discovery instead of permanent exclusion.
5. Enough outcomes resolve to assess probabilities and forecaster skill.

No cohort size, success threshold, timeframe, or metric weighting is approved. Long-horizon fundraising/revenue goals may be engaging but slow to validate; a mixture of shorter and longer outcomes is an interview proposal.

## Pending decisions

See EXECUTION.md D01-D03, D05, D07, D08, D10 and D11. The app is named Mitra (owner decision, 2026-09-16, replacing the earlier name Mirai); the project folder keeps its original name. Collusion controls, evidence handling, a launch-goal template, exact trading metrics, discovery allocation and final MVP screens remain open.
