# Deep review of the master brief

Reviewed: 2026-09-15. Source: `Prediction_Market_MVP_Master_Prompt.pdf`, all 18 pages; text extraction and rendered-page inspection.

## Interpretation

This is a product thesis plus a question-driven development contract, not a final app specification. It prioritizes verification, discovery and persistent project memory alongside a play-money trading experience. Many long lists are deliberately labeled candidates. Implementing all of them immediately would contradict the brief.

## Requirement map

| Pages | Sections | What they establish |
| --- | --- | --- |
| 1-2 | Cover, 0-1.2 | Active interview, authority ladder, no early major implementation, execution record |
| 3-4 | 1.3-3.1 | Required documents, opted-in people/achievement thesis, three engines, V1 constraints |
| 4-5 | 4-6 | Consumer/social mobile experience, candidate screens, mechanism gate, ledger, profiles |
| 6-7 | 6.2-8 | Subject permissions, verification interview, candidate methods/statuses, provenance, honest-information incentives |
| 8 | 9-11.1 | Correction/fraud distinctions, market rules and resolution, recommender research mandate |
| 9-10 | 11.1-13 | Ranking interview, candidate features, no unapproved formula, popularity feedback risks |
| 11-12 | 13.1-17 | Retrieval/eligibility, cold start, reputation research, event logging, versioning/experiments |
| 13-14 | 18-22 | Manipulation, privacy/allowed outcomes, admin operations, stack gate, candidate entities |
| 15-16 | 22-26 | Schema gate, implementation workflow, coding practices, challenge assumptions, research |
| 17-18 | 26-30 | Tentative priorities, first-response obligations, staged validation, ask/document/build |

## Eleven major decisions

Before MVP architecture: (1) cohort/outcome horizon/age/consent, (2) creation authority and subject control, (3) market mechanism and play-money economy, (4) lifecycle/resolution/cancellation, (5) stack and operating constraints.

Before verification architecture: (6) evidence standards and authority, (7) privacy/retention/status history/disputes.

Before recommendation: (8) session objective and discovery allocation, (9) measurement, attribution and feedback-loop controls.

Can largely wait: (10) public reputation and incentive UI, though required probability observations must be planned earlier; (11) expansion features and automation. See EXECUTION.md for live decision status.

## Gaps to resolve explicitly

1. **Consent is not uniformly specified.** Section 2 centers opted-in people, section 3.1 says to prefer adults/opt-in, and section 6.2 leaves future public-figure exceptions as questions. Confirm enforceable V1 admission rules.
2. **Withdrawal has several meanings.** Profile visibility, evidence deletion, trading pause, consent withdrawal and settlement are distinct. Define their interaction before users hold positions (sections 6, 10, 19).
3. **One example is not binary.** The founder race example on page 3 needs ties, multiple outcomes and possibly non-occurrence rules; the market engine discussion starts binary. Confirm V1 scope.
4. **Dates do not define temporal truth.** Reaching a threshold by June 30 can be proven in July. Define event time, trade close, evidence deadline, timezone, persistence of thresholds and source corrections (section 10).
5. **A pricing formula is not an economy.** Granting/replenishing points, funding liquidity, rounding, limits and self/related-party trading shape incentives and profit comparisons (sections 5 and 18).
6. **Verification labels mix dimensions.** Submitted/pending describe workflow; admin/source/machine describe method; disputed/revoked describe validity. Decide the actual model before implementing a status enum (section 7.1).
7. **Verification needs a claim boundary.** Account control, document authenticity, factual truth and resolution sufficiency are different assertions (sections 7 and 10).
8. **Auditability does not settle retention.** Indefinite raw evidence storage is not implied by immutable ledger/history requirements (sections 7.3 and 19).
9. **The three systems still influence each other.** Discovery affects participation, which affects price, which may feed momentum ranking. Separate responsibilities do not remove the need to measure this feedback (sections 2.2 and 12).
10. **Trades do not directly measure beliefs.** Position size depends on bankroll and price, not only probability. Decide a probability-observation protocol before claiming Brier/log-scored individual forecasting skill (section 15).
11. **Long outcome horizons delay validation.** The pilot can measure return and information use before outcomes resolve; it cannot thereby establish accurate probabilities or durable forecaster skill (sections 3 and 29).
12. **Truthful disclosure and attention can conflict.** If subjects receive visibility mainly for exciting good news, the incentive principle on page 7 fails even without an explicit YES-price reward. The incentive and ranking interviews need to address selective disclosure together.

## Riskiest assumption and proposed early check

The principal risk is the supply of timely, credible information and sufficiently independent attention: will subjects keep disclosing setbacks, and will forecasters keep returning when there is no money to win? Sparse activity can make a precise-looking market price uninformative.

Propose a narrow pilot with observable outcomes and a complete information-to-trade-to-resolution loop. Do not assume a specific cohort size, duration, threshold or mechanism. Agree those with the user, and assess disclosure behavior, review effort, voluntary revisits, discovery and resolved predictions separately.

## Recommendation for the first build

Once the relevant decisions are made, prove one subject, one well-specified market, one auditable trading path, one update/review workflow and one reproducible resolution before expanding the screen inventory. Include measurement when the first feed appears. If private evidence is essential, establish its restricted review boundary earlier. See ROADMAP.md for conditional slices and acceptance gates.
