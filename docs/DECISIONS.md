# Decision log

Entries distinguish requirements carried from the user-supplied brief, routine project work, recommendations, and decisions awaiting the user.

## 2026-09-15 - Source review and documentation

**Status:** completed, within the user's request.

**Action:** reviewed the 18-page PDF and created its required project documents before major implementation.

**Rationale:** the user requested a deep read and questions; the brief explicitly reserves important behavior and architecture choices for the user and requires persistent memory.

**Alternatives considered:** immediately scaffold the PDF's suggested Next.js/PostgreSQL stack; treat the conceptual ranking formula and candidate verification statuses as final.

**Disposition:** not selected because the brief explicitly labels these choices as candidates and requires interviews. This does not reject any technology or mechanism on its merits.

## 2026-09-15 - Requirements carried from the brief

**Status:** source requirements, not new independent product decisions.

- V1 is play money with no cash conversion or real-money flows.
- Separate market, information and discovery responsibilities.
- Audit transactions, preserve provenance, log events before sophisticated ranking, and keep project documentation current.
- Do not equate personal worth with market probabilities or punish factual negative disclosures merely for lowering a market price.
- Avoid premature ML/microservices/native mobile expansion.

**Unresolved qualification:** adult/opt-in language varies between firm product description and preference. Confirm the enforceable admission policy rather than presenting it as settled.

## 2026-09-15 - First interview

**Status at intake:** asked; partially answered in the follow-up below.

Five questions cover launch cohort, proposal/approval permissions, primary feed objective, evidence scope and technology preferences/existing code.

**Recommendation presented at intake:** consider Next.js/TypeScript, PostgreSQL and Supabase login/storage for iteration speed, with provider dependence as a tradeoff. At that time the user had not approved a stack. The follow-up below delegates technical selection.

**Next:** record answers and rationales here. Do not infer approval from a preselected option or from time elapsed.

## 2026-09-15 - First interview answers

**User response:** questions 1 (launch audience), 3 (successful feed use), and 4 (evidence) need explanation. Question 2: "at first me, but id be training you and youd have to copy my decison making abilties eventually". Question 5: "no whatev u wanrt to do".

**Confirmed:** the owner initially decides which markets are created. The user wants eventual AI decision-making that reflects their judgment. They report no technology preference and delegate stack selection to the assistant.

**Not inferred:** the answer does not grant the future AI immediate independent approval, specify acceptable error rates, decide subject permissions, or assign verification/settlement powers. Technical delegation does not delegate feed objectives, evidence policy or market mechanics.

**Proposed implementation direction:** capture owner decisions, reasons and corrections in the future review workflow; use saved examples and rules to generate recommendations; measure agreement on separate cases before discussing broader autonomy. This is a proposal, not an implemented training system or a claim of identical judgment.

**Communication adjustment:** explain product questions using everyday examples. Replace "cohort" with "first people on the app," "feed objective" with "what someone gets out of using the app," and "evidence scope" with "what proof we accept".

**Next questions:** clarify the first people to feature, the desired outcome after a few minutes of use, and the types of proof to accept. Do not ask the user to choose the technical stack again.

## 2026-09-15 - Community, goals, experience and evidence answers

**Status:** confirmed direction; remaining details explicit below.

**Community and scope:** the user can recruit friends and OSU students and emphasized that markets can concern any goal. This supersedes an exclusive founders/creators or professional-achievement focus. Which OSU is unspecified. Goal wording and allowed boundaries are not settled by the phrase "any goal".

**Experience:** "Goal is too maximize trades"; the user also wants to educate traders. Trade activity is the primary objective, informed trading a supporting aim. No weighting, metric definition or ranking formula chosen.

**Evidence:** selected public sources plus private documents reviewed by the owner, and the current third option of a real-example walkthrough. No automated verification API approved.

**Next:** ask which OSU, request two or three realistic goals, and confirm whether initial subjects must be 18+, join voluntarily and approve each listed goal. Use examples to discuss proof and resolution.

## 2026-09-15 - Technical foundation selected under delegation

**Authority:** the user explicitly said they have no preference and the assistant can choose.

**Decision:** use Next.js App Router with React/TypeScript, PostgreSQL on Supabase, Supabase Auth, private Supabase Storage for the accepted upload capability once privacy rules are decided, and Drizzle for server database access and reviewable SQL migrations. Start with one web application with separate market/information/discovery modules; add separate services only when a requirement justifies them.

**Rationale:** shared TypeScript development, relational transactions and constraints, integrated identity/storage, and readable SQL migrations suit the project's auditable records and a small-team MVP.

**Tradeoffs and alternatives:** Supabase creates some provider dependence and requires careful authorization, connection pooling and storage policy design. A separate backend adds deployment and interface coordination before a demonstrated need. Clerk or Auth.js would add separate identity decisions; Prisma remains viable but Drizzle is selected for explicit SQL-oriented data access. None of these alternatives is judged generally inferior.

**Scope:** no hosting account/subscription created, deployment made, package version pinned, application schema chosen, AI provider selected or model trained. See TECH_STACK.md for verified sources and implementation constraints.

## 2026-09-15 - Ohio State, example goals and Kalshi reference

**Confirmed:** OSU means Ohio State. This is the initial recruiting community, not an approved geographic/university access restriction. The user gave GPA, club admission, internships, launches and gym goals as examples and repeated that goals can be broad.

**Eligibility/trading direction:** the user said to use Kalshi's rules for trading and expects the people being predicted about to be 18. Preserve V1 play money. Research official eligibility/integrity/mechanics, distinguish them from subject consent, and clarify any consequential adaptation before implementing it. Do not present Kalshi's trader-age requirement as a rule about subjects.

**Open:** the user did not answer voluntary participation or per-goal approval. Asked one focused question about requiring the subject's approval before publishing a market.

**Communication:** "planning the first community" meant tailoring initial examples/flows to the people the user can recruit. Explain this plainly; it does not commit to an Ohio-State-only app.

## 2026-09-15 - Goal creation, self-trading and insider-trading answers

**Context:** asked four questions grounded in Kalshi's published rules: subject approval, self-trading, trading on private knowledge, and trade mechanism. Kalshi facts used: 18+ traders; binary contracts quoted 1-99 cents paying $1; order book matching; traders with any direct or indirect influence over an outcome are prohibited from trading it; trading on material non-public information is prohibited. The CFTC's 25 February 2026 enforcement advisory gives a candidate trading on his own candidacy as a self-dealing example. Sources are in RESEARCH.md.

**User responses:**
- Approval: "imo my idea was to get the person to create the goal about themself. maybe we can do a hybrid, they input thier info and it generates goals but also allows them to make their own goals"
- Self-trading: selected "No, same as Kalshi" (the option also barred other people who decide the outcome, such as a club board voting on admission).
- Private knowledge: "the goal was to make the goals approved by me, and it would be goals that arne't just easy to just achieve. its not like an on or off swithc where u can jsut achieve the goal with the desicicon in ur mind. this was the way to prevente insider trading"
- Mechanism: "Well how did kalshi start when it had no users" (a question, not a selection).

**Confirmed:**
- Subjects create markets about their own goals. Hybrid creation: the subject enters information about themselves, the app suggests goals, and the subject may also write their own. The owner approves before publication. A subject creating their own goal is the consent for that market.
- Kalshi-style self-trading ban: a subject cannot trade markets about their own goals, and neither can other people who decide the outcome.
- Owner approval standard includes: a goal must not be achievable by simply deciding to (no "on/off switch" goals). The user's stated purpose is to prevent insider trading.

**Not inferred:**
- How suggestions are generated (fixed templates or an AI model), what information subjects enter, and whether that information is stored or sent to an external AI provider.
- Whether anyone other than the subject may propose a goal about someone.
- Whether friends may trade on private knowledge. The answer addresses influence over the outcome, not knowledge about progress; follow-up required.
- The market mechanism. Unanswered; the user asked for Kalshi's launch precedent first.

**Gap raised with the user:** a hard goal stops someone deciding to succeed, but failing is almost always a choice (skip the gym, withdraw an application). The self-trading ban removes the subject's own incentive to fail; a friend betting NO in collusion with the subject remains possible. Related-party handling needs a decision.

## 2026-09-15 - Mechanism, friends, goal suggestions and visibility

**Research presented before asking:** Kalshi's help center says customers always trade against another platform member, not the exchange. Press reports (Sportico 2025; The American Prospect, August 2026) describe an affiliated market maker, Kalshi Trading LLC. Kalshi announced SIG as its first dedicated institutional market maker in April 2024. Polymarket moved from an AMM to an order book in late 2022. Manifold (play money) combines an AMM with limit orders. See RESEARCH.md section 7.

**User responses:**
- Mechanism: selected "Market-maker bot".
- Friends/collusion: "we need to research this more. go with 1 for now". Option 1: friends may trade using what they know, each person has a maximum per market, and the owner may cancel trades of anyone caught colluding.
- Goal suggestions: "1 and 2" (fill-in templates and AI-written suggestions).
- Visibility: "2" (anyone with the link can see markets).

**Confirmed:**
- An app-run market maker is always the counterparty, so trades execute immediately. Prices appear Kalshi-style as cents per YES/NO share paying 100 on the winning side. Limit orders may be added later.
- Goal creation offers both fill-in templates and AI-written suggestions from what the subject enters. The subject may still write their own goal, and the owner approves every market. The option presented stated that AI suggestions send the subject's input to an AI company and cost money per use.
- Market pages are viewable by anyone with the link.

**Provisional (user requested more research):** people other than the subject and outcome decision-makers may trade using their own knowledge, subject to a per-person maximum per market; the owner may cancel trades of participants found colluding. Research collusion and related-party controls before treating this as final.

**Mechanism implementation:** binary LMSR, as named in the recommended option of the first mechanism question. Worst-case play-money subsidy is b ln 2 per market (RESEARCH.md section 1). Manifold's CPMM is the main alternative. The liquidity parameter changes how far each trade moves the price and must be set with the economy settings.

**AI provider (technical delegation):** Anthropic Claude API, called only from server code. The user must create the API key and billing account. Model, prompt, which inputs are sent, retention and spending limits are set at implementation.

**Not inferred:**
- Search-engine indexing of link-viewable pages, and what logged-out visitors see. Trading presumably requires an account because it needs a wallet; confirm when designing the flow.
- Starting balance, refills, the maximum amount per market, and accounting for cancelled collusion trades.
- Disclosure wording to subjects before AI suggestions, and retention of their input.
- Private evidence remains off public pages by default; visibility of markets does not extend to proof documents.

## 2026-09-15 - Node installation, play money, bet limit and search indexing

**User responses:**
- Node.js: selected "Yes, install it" (Node.js 24 LTS via winget, then npm packages for the app).
- Play money: "2, but you get 2 refills a monht. subject to change". Option 2 was 1,000 once with no refills.
- Per-market maximum: "1" (100 points per person per market).
- Search indexing: "2" (search engines may find market pages). Chosen over the recommendation, after its stated tradeoff that someone searching a person's name could land on their markets.

**Confirmed (implement as configuration; the user said the economy is subject to change):** 1,000 starting points; two refills per month; a 100-point per-person maximum per market; public market pages that search engines may index.

**Clarification:** a winning share is worth 1 point, as the brief specifies. The earlier question wording "YES 62¢ pays 100" meant 100¢, i.e. 1 point.

**Not inferred; follow-up needed:** refill amount and whether refills are automatic or claimed; the month boundary; whether the 100-point maximum caps net amount at risk or total spent; whether selling before resolution is allowed; the liquidity parameter b; leaderboard ranking basis given refills.

**Download authority:** the user approved installing Node.js LTS via winget and app libraries from npm. This does not approve creating hosted accounts, API keys or deployments.

## 2026-09-15 - Price sensitivity, refills, selling and the limit definition

**Research presented:** LMSR price-impact simulation for b from 50 to 500, with markets opening at 50% (table in MARKETS.md).

**User responses:**
- Price sensitivity: "do whatever kalshi did if thats 1 then thast fine" (option 1 was Medium, b = 150).
- Refills: selected "Tap to top up to 1,000".
- Selling: selected "Yes, while trading is open".
- Limit: selected "Money in it right now".

**Confirmed:**
- Liquidity b = 150 as the configurable default for new markets. Kalshi has no equivalent setting: its order book moves only as resting orders from market makers and other traders fill, so "what Kalshi did" cannot be copied directly, and the user's stated fallback of option 1 applies.
- Refill: when a user's balance is below 1,000 they may tap Refill to restore it to 1,000, at most twice per calendar month in Eastern time (America/New_York), as stated in the option.
- Selling back to the market maker is allowed while trading is open.
- The 100-point maximum counts the cost basis of shares a person currently holds in that market, both sides combined. Selling releases cost basis at average cost, freeing allowance.

**Implementation choices within these decisions:**
- Kept cost basis rounds up after a partial sale, so rounding never frees extra allowance.
- The Kalshi influence ban applies to sells as well as buys, following Kalshi's prohibition on entering any trade.

**Interpretation to confirm:** "balance" for refills is implemented as available points, excluding money held in open positions. Someone holding positions can therefore refill while those positions are open.

**Newly identified open question:** the opening price of a new market. The simulation assumed 50%, which may overstate the chances of hard goals the owner approves.

## 2026-09-15 - Opening price, refill basis, sign-in and version control

**User responses:**
- Opening price: selected "You set it when approving".
- Refill basis: selected "Only cash counts".
- Sign-in: "osu email first, open it later once we establihs priduct market fit".
- Version control: selected "Yes, install Git".

**Confirmed:**
- The owner sets each market's opening probability when approving it. The engine supports any opening price through `stateAtProbability`.
- Refill eligibility uses available cash only; money in open positions does not count, so cash plus positions can exceed 1,000. This confirms the implemented behaviour.
- Sign-in at launch requires an Ohio State email address, opening wider after product-market fit. This is a launch gate, not a permanent policy.
- Git is installed and the project has version history.

**Consequences recorded, not decisions:**
- An OSU email gate excludes the user's non-OSU friends, who were named as part of the first community.
- An OSU address evidences a current university account. It does not establish that the holder is 18+, or that they are the person a market concerns. The age-check method stays open.
- Supabase Auth does not restrict sign-up domains by itself; the restriction must be enforced in application code or an auth hook, and tested.
- Opening a market away from 50% changes the market maker's worst-case loss to -b ln(opening price of the winning side). At b = 150 a market opened at 30% can lose about 181 points if YES wins, against 104 at 50%.

## 2026-09-15 - Model choice and budget for AI goal suggestions

**Question from the user:** how much to load the Claude key with, whether a cheaper or different provider is better, and whether the next AI agent can handle the keys.

**Decision (technical delegation):** use `claude-haiku-4-5` for goal suggestions, at $1 per million input tokens and $5 per million output (Anthropic first-party rates, from the bundled API reference cached 2026-06-24). Drafting a few goal options from a short profile does not need a frontier model. Do not use an Opus- or Fable-tier model for this feature.

**Alternatives priced:** Google's published pricing puts Gemini 3.1 Flash-Lite at $0.25/$1.50 and Gemini 2.5 Flash-Lite at $0.10/$0.40 per million tokens, cheaper than Haiku but requiring a second provider account for a few cents a month at pilot scale. OpenAI's official pricing page returned HTTP 403; third-party reports put GPT-6 Astra at $10/$50 per million, roughly ten times Haiku for a task that does not need it. Revisit if suggestion quality proves inadequate in testing.

**Budget estimate:** about 800 input and 300 output tokens per suggestion request, so roughly $2.30 per thousand suggestions on Haiku. A pilot of 50 people creating three goals each costs well under a dollar.

**Billing mechanics (Anthropic support documentation):** API usage runs on prepaid credits bought in the Console under Billing. Auto-reload is optional; leaving it off caps total spend at the credits purchased. Credits expire one year after purchase and are non-refundable. A specific minimum purchase amount was not verified.

**Secrets:** `.env.example` now lists every variable name. Keys live only in `.env.local`, which Git ignores, and the owner enters them personally. AGENTS.md carries the rule for whichever agent works on this next.

## 2026-09-15 - Market lifecycle and resolution (D04)

**Context:** seven plain-language questions using the user's own GPA, internship, club and launch examples. Every answer took the recommended option.

**Confirmed:**
- Trading closes automatically at the goal's deadline, and the owner can also close a market early once the outcome is already public. Chosen over deadline-only (which lets whoever hears the result early trade on a certainty) and manual-only (which relies on the owner never forgetting).
- The subject has 7 days after the deadline to supply proof. Chosen over 3 days, which final grades can outrun, and 30 days, which freezes points and attention.
- No proof by that deadline resolves NO. Rejected: cancel-and-refund, which lets someone who is failing void the market by going quiet and burns correct NO holders; and case-by-case rulings, which traders cannot predict.
- After the owner rules, a 24-hour contest window runs, during which anyone may object and the owner may change the ruling. Payout then happens and is final. Chosen specifically so points are never clawed back from people after settlement.
- Wording is frozen once trading opens; a broken market is cancelled and republished.
- A subject deleting their account or withdrawing cancels their open markets immediately, consistent with markets existing only because the subject opted in.
- Cancellation refunds each trader the cost basis of shares still held; the market maker absorbs the difference.

**Known cost the user accepted:** resolving NO on missing proof penalises a private person who genuinely succeeded, and rewards NO holders for that silence. Recorded for review during the pilot.

**Assistant defaults inside these decisions (not separately confirmed):** markets close at 23:59 America/New_York on the deadline date, matching the refill month boundary; the contest window runs 24 hours from the owner's ruling.

**Still open:** binary-only scope for V1, what counts as the event happening for each goal type, template wording, and evidence that appears after settlement.

## 2026-09-16 - Password sign-in and adult self-confirmation

**User choices:** "Email and password" and "Require users to confirm they are 18 or older".

**Confirmed:** implement Supabase email/password signup/sign-in, verification of the Ohio State email, sign-out, and password recovery/reset. Require an explicit 18+ self-confirmation before creating an active app profile and issuing the one-time 1,000-point grant. Record the affirmation time on the server. Do not collect a birth date or identity documents for this version. The checkbox is an assertion, not independent age verification.

**Technical handling under delegated authority:** canonicalize accepted `@buckeyemail.osu.edu` inputs to `@osu.edu`, because Ohio State's [August 19, 2026 announcement](https://it.osu.edu/news/2026/08/19/students-now-have-one-email-account-lastnameosuedu) says both forms reach the same mailbox. Require verified canonical email at protected app boundaries. This prevents those aliases from independently receiving signup grants through this path; it does not establish current enrollment or guarantee one account per human across all identity changes.

**Profile completion:** collect display name, a normalized unique handle and the explicit adult confirmation. Use the verified Auth user id; ignore client-supplied ids, balances and owner roles. Existing accounts must never receive another signup grant merely because the request was retried.

## 2026-09-16 - Goal templates: what counts as YES

**Context:** four questions using the owner's own examples, asked before building goal creation. Every answer took the recommended option.

**Confirmed:**
- **GPA:** the goal counts that semester's GPA once final grades post on the official record. The deadline is the grade-posting date, not the last day of class. Rejected: cumulative GPA, which moves too slowly for a one-semester goal; letting the subject choose, which adds a way to misread a market.
- **Internship:** a written offer received before the deadline counts, even if the subject declines it. Rejected: accepting the offer, because accepting is the subject's own choice and would break the owner's rule that a goal cannot be achieved or failed simply by deciding; starting the internship, which keeps markets open for months.
- **Club:** the club's admission offer before the deadline counts, whether or not the subject then joins. Rejected: officially joining, for the same on/off-switch reason.
- **Gym:** proven by one uncut video of the achievement, posted publicly (for example Instagram, TikTok or YouTube) before the deadline, with the link reviewed by the owner. The app stores no video. Rejected: another member vouching, which invites the collusion the owner already flagged; leaving gym goals out.

**Not decided:** a launch template (what counts as launched). Until then, launch goals are written in the subject's own words and judged at approval.
