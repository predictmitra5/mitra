# Decision log

## 2026-10-20 — startup exchange, funding closed (current)

The user-supplied exchange blueprint supersedes earlier college eligibility, dual currencies, QR rewards, LMSR execution and fake-funds instructions. Preserve the video-first design at 9dd7982 and the founder/startup/social discovery features. Use integer USD cents, fully collateralized binary contracts, deterministic price/time limit matching, append-only double-entry accounting and isolated test fixtures only. Accounts start at zero; deposits, withdrawals and customer execution remain server-disabled pending a verified operating arrangement, settled-custody integration, identity/geographic eligibility and launch authorization. No environment flag or owner grant may bypass these gates. Every eligible card exposes Yes and No with independent executable asks; empty books have no fabricated quote. Preserve demo content as fictional illustration without monetary activity or live financial statistics. Retain the verified predictmitra@gmail.com and murugan.23@osu.edu owner identities; account/data reset requires a current recoverable export and exact dry-run. Existing historical decisions below are superseded wherever they conflict.


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

## 2026-09-16 - Product name

**User response:** "the name for the app is Mirai".

**Confirmed:** the app is called Mirai. It replaces the placeholder "Goal predictions" in the interface and the working folder name "Kalshi for People" everywhere except the folder itself, which keeps its name so existing paths and agent sessions stay valid.

**Not inferred:** no logo, domain, tagline or visual identity was chosen with the name.

## 2026-09-16 - Product name changed to Mitra

**User response:** "name is Mitra". Asked whether this meant renaming the app from Mirai, the owner selected "Yes, rename to Mitra".

**Confirmed:** the app is called Mitra. This supersedes the Mirai entry above; the interface, package name and current-state documents now use Mitra.

## 2026-09-18 - Ruling revisions and objection privacy

**User choices:** "Yes, restart the 24 hours (recommended)" and "Public ruling explanation; private objections (recommended)".

**Confirmed:** changing a YES/NO ruling during its objection window starts a fresh 24-hour window for the revised ruling. The owner's written ruling explanation is public. An objection and its text are visible only to the owner and the person who submitted it. This does not authorize publication of private evidence originals. Settlement remains final, as decided on 2026-09-15.

## 2026-09-19 - Navigation to a trader's existing positions

**Context:** the proposed next build slice was "a page showing each trader's existing positions." The owner answered: "Ok go ahead".

**Confirmed:** add a private page where the signed-in trader can find their existing holdings and open the corresponding market. This presents the already-approved YES/NO shares, held costs, market states and buy/sell navigation across their goals. It does not authorize public portfolios, an owner override to view others' holdings, discovery ranking, a leaderboard, or new valuation/economy rules.

**Technical presentation under delegated authority:** `/positions`, titled "Your predictions", shows nonzero active holdings, soonest deadline first, in bounded pages. Fully sold, settled and refunded positions no longer have active shares; the page explains that they leave this list. Existing market pages remain the place to preview and confirm trades. Historical trading statements are a later feature.

## 2026-09-19 - Email confirmation suspended for the pilot

**User instruction:** "bro just remove emial verificaiton ill add it later".

**Context:** no SMTP provider is connected, so Supabase delivers only to members of the Supabase project team. Nobody could receive a confirmation link, and this had blocked every real-account walkthrough for four days.

**Confirmed:** signing up and signing in no longer require a confirmed mailbox. The requirement returns before anyone outside the owner's own circle joins; the owner said "ill add it later" and this entry is the record of that intent.

**Not inferred:** the `@osu.edu` restriction stays, passwords stay, and the app still re-verifies identity server-side at every boundary. Nothing about age self-confirmation, the economy or market rules changes. No decision was made to launch or invite anyone in this state.

**Consequence the owner accepted:** the `@osu.edu` gate now proves only that an address was typed, not that the person owns that mailbox. Anyone can claim any Ohio State address, including one belonging to somebody else.

**Technical form under delegated authority:** an environment switch rather than deleted checks, so restoring it is one line and no deployment can lose the protection by accident. `AUTH_REQUIRE_EMAIL_CONFIRMATION=false` in `.env.local` disables it; any other value, including unset, requires confirmation. Supabase's own "Confirm email" setting must be turned off to match.

## 2026-09-19 - Public feed, ranking and signed-out browsing

**User instruction:** shown the Kalshi and Polymarket home pages, "this is the ui i want for my markets. all thre marekts will popuup like a yotube algorhtim behdin it. also let anyone see it withotu an account and then proomtp a popup."

**Interview answers:** ordering - "idk cop kalshi and polymakret, do in depth research on how there algirhtim and how other osocial apps algrithim works to show and copy that", then "okay ill take ur recommendation". New goals - "just added row and then like tiktok we show it to other people and evlaute how well peopel are clicking on it". Categories - "tabs by person". Popup - "give them two minutes to create an account".

**Confirmed:**

- The home page is a public browsable feed of approved goals, shaped like Kalshi's and Polymarket's card grids. No account is needed to browse it or to open any goal page.
- A visitor with no account is prompted to create one after two minutes of browsing. The prompt is dismissible; it is a prompt, not a wall.
- Goals are grouped by person, not by topic. Tabs across the top are the people with open goals.
- Newly approved goals get a "Just added" row, and exposure and clicks are recorded so that later ranking can evaluate how goals actually perform, in the way the owner described TikTok doing it.
- Ranking order, delegated to research and then accepted by the owner: an activity score over time decay, in the shape Reddit and Hacker News use, because those work without training data. `interest = log10(1 + clicks + 5 x trades + 3 x unique traders)` over the last 24 hours; a newborn bonus of 1.0 for the first 48 hours after approval, fading to zero; a 1.5x multiplier when the deadline is within 72 hours; all divided by `(hours since approval + 2) ^ 1.5`. Gravity is 1.5 rather than Hacker News's 1.8 because goals run for weeks rather than hours.
- Fairness cap, recommended and accepted: no single subject holds more than two of the top ten feed slots. Without it the most popular person's goals crowd out everyone else, which contradicts the owner's stated wish that a broad range of people's goals get seen.

**Not inferred:** no personalization per viewer, no follows, no notifications, no leaderboard, no comments, no search. Signed-out visitors see exactly what the already-approved public market pages show: public display name, handle, goal terms, prices, deadlines and outcomes. Nothing private becomes public because browsing became public.

**Deliberately deferred by the owner:** profile pictures ("sure, add pfp option but we willd o it later"). Recorded in EXECUTION.md under Deferred.

**Recorded limitation:** exposure and click counts are stored without any viewer identity, so they cannot be deduplicated per person and can be inflated by refreshing. This is the privacy-preserving choice for a first version and is honest about what the numbers mean. Per-viewer measurement needs its own privacy decision (D08, D09).

## 2026-09-19 - Evidence submission, redaction and retention (D06, D07)

**Context:** the owner chose to settle evidence before deploying. Asked whether evidence was already built, the answer was no: the seven-day proof window, the goal terms that resolve NO without proof, the ruling basis options and the public promise that private documents stay off the page all exist, but no way to send, store or view proof exists at all. The app says so itself in the owner controls.

**User answers:**

- Form of proof: "Upload a file, or paste a link", their choice per goal.
- Who sees it: "everyone, it is publci, but we shoudl redact private info".
- Retention: "Kept as a permanent audit trail".
- Objectors: after being shown that public visibility makes objector access moot unless the public version is redacted and objectors get the original, the owner chose "Nothing extra - same as everyone". Verification of an objection decides whether it is taken seriously, never what the objector can see.
- Redaction: "Automatic redaction, you approve it".

**Concern raised before the choice, and the owner's resolution:** public plus permanent plus redacted is the least forgiving combination available. A redaction that misses a student id or an address is published about a named person at a named university, permanently, with no undo, and automatic redaction of a photographed document fails silently. The owner chose it with the approval gate, which is the mitigation: nothing is published until a human has looked at the full original and deliberately confirmed.

**Confirmed:**

- A subject may attach proof to their own goal during the seven-day proof window: an uploaded file, a pasted link, or several of either.
- Every submission is reviewed by the owner before anything becomes visible. Nothing publishes automatically.
- Files: automatic detection proposes regions to hide; the owner sees the whole original, adjusts the proposal and confirms. The published artifact is a newly rendered image with those pixels destroyed. The original is never served to anyone but the owner.
- Links: published as submitted. A URL cannot be redacted, so a subject choosing a link is choosing to publish whatever is behind it. The submission form must say so.
- Approved proof is public on the goal page, to everybody, with or without an account.
- Originals and published versions are both kept permanently, as the audit trail behind every ruling.
- An objector sees exactly what the public sees. Objection verification gates whether the owner acts on it, never access to anything.

**Not inferred:** no change to who rules, to the twenty-four hour objection window, to payouts, or to the rule that missing proof resolves NO. Traders still cannot submit proof about somebody else's goal. No automatic ruling from evidence: the owner still decides, and proof is input to that decision rather than a replacement for it.

**Technical form under delegated authority:** redaction burns pixels into a re-encoded image rather than drawing an overlay, because an overlay can be removed by anyone who downloads the file. Automatic detection is a suggestion engine and is described that way in the interface; the owner's confirmation is the control that actually protects the subject. Originals live in a private store that the browser key cannot read, as with every other table.

**Left open:** deletion. The owner chose permanent retention, so there is currently no route for a subject to withdraw a document once it is published. Account withdrawal already cancels a subject's markets; what it should do to their published proof is not decided and is recorded in EXECUTION.md as open.

## 2026-09-19 - Deleting proof when an account goes away

**User instruction:** "obv tehre shoudl be data delition for an account going away."

**The conflict this resolves:** earlier the same day the owner chose permanent retention, and left deletion open. Read literally the two answers contradict each other. They do not once the two things being kept are separated.

**Confirmed:**

- When someone withdraws, their submitted documents go: every original in the private bucket and every published artifact in the public bucket, for every goal they were the subject of.
- What survives is the record that a decision was made: the ruling, its written explanation, who reviewed it and when, the trades and the ledger. A deleted item leaves a visible tombstone on the goal, saying proof was supplied and later removed at the person's request.
- This is what "permanent audit trail" was for. The trail is the chain of decisions, not a permanent copy of a student's transcript.

**Consequence accepted:** a settled ruling can become unverifiable after the fact, because the document behind it is gone. The payout does not move: settlement is already final and the ledger is untouched, so deletion cannot change anyone's balance.

**Not inferred:** nothing here decides what else account withdrawal does, which is still unbuilt, nor whether a subject can delete a single piece of proof without leaving. Deleting one item while staying is not decided.

## 2026-09-19 - Verified statements replace publishing the document (supersedes part of D07)

**User instruction:** "maybe we just do this. the user uploaded the everifeid inforamtion, and we just put that in the verifcied information setting using jsut reading the pdf. we leave out the condidential stuff ourself, no need for redactaiton. and then obv wed have to add ac ontract saying that all info we post there is verfied or wtver".

**What prompted it:** the redaction screen was built and then measured against a fictional transcript. The model named the right four private items and placed every box about 85 pixels too high, leaving the home address and phone number readable under boxes that looked like the job was done. Its reading of the document was exact; only its aim was wrong.

**Confirmed, superseding the earlier choice that approved proof is public:**

- An uploaded document is never published. It is read, kept privately as the audit trail, and never served to anyone but the owner.
- What becomes public is a short verified statement the owner confirms, such as "Fall 2026 GPA 3.85, checked against an official transcript". The confidential parts are left out because they are never carried across, not because they were covered up.
- Redaction is removed. There is nothing to redact when nothing is published.
- PDFs are now accepted, because the app only has to read one, never render a safe copy of it.
- A link is still published exactly as submitted. Submitting a link is already a decision to publish whatever is behind it, and the form says so.
- A public attestation accompanies published statements: that each one was checked by the owner against an original the app still holds, and that the original is deliberately not shown.

**The tradeoff the owner accepted:** proof was made public so traders could check a ruling themselves. They no longer can. Transparency moves from the document to the owner's attested statement, and the owner's record is what backs it. This was stated before the change was made.

**Unchanged:** only the subject may submit, only during the proof window; the owner reviews everything before anything is visible; originals are kept permanently; an objector sees exactly what the public sees; withdrawing an account deletes the documents and leaves a tombstone.

**Not inferred:** no automatic ruling from a statement. Extraction proposes wording, the owner confirms or rewrites it, and the ruling remains a separate decision.

## 2026-09-24 - Profile photos, bans, "bet on literally anything", live prices

**User instruction:** "I need to create a lot of persimissons for the owner accounnt. first off, how can we add a methodology that allows us to get pfps for aeveryone posting a goal. we also make sure the pfp isnt ai generated. qlso, is it possibel to prefer users that have a pfp in the algorithm. ... also, make sue the mian thing is bet on literally anytng that should be the motto ... need to make the stock ticker look more liek a stock ticker. does it have real time updates? ... also, make sure the owner accoutns cna ban people." Four choices were then put to the owner; their answers are quoted below.

**Profile photos. Answer: "Required to post a goal".**

- Anyone writing a goal needs a profile photo first. Browsing and betting do not need one.
- The photo is public wherever the person's name appears: feed cards and thumbnails, goal pages, the review queue, positions. Posting a goal on a public feed already puts the person's name there; the photo goes with it.
- One photo per person, replaceable or removable at any time. Removing it blocks new goals; existing goals fall back to initials.
- Stored privately and served by the app, re-encoded to a 512-pixel square with every piece of metadata stripped, including the location a phone writes into a photo.
- No feed boost for having a photo. The owner accepted the recommendation that it is unnecessary once every goal has one.
- Deleting the photo when an account is withdrawn belongs with the unbuilt withdrawal flow, like proof.

**Keeping out AI-generated photos. Answer: "Auto-check AI labels" only.** The owner did not choose approving every photo by hand, camera-only capture or a paid detector.

- An upload is refused if its metadata declares it AI-generated or AI-composited (the IPTC digital source types that C2PA content credentials also use) or carries a known generator's signature (for example Stable Diffusion's saved parameters, ComfyUI workflows, DALL-E, Midjourney, Adobe Firefly).
- Limit, stated to the owner: this only catches images that still carry the labels. A screenshot, or any tool that strips metadata, passes. Nothing available can guarantee a photo is not AI-generated.
- The owner still sees each person's photo beside their goal in the review queue before approving it. A photo changed after that goes live after the automatic check only.

**Owner permissions (technical form under delegated authority, within "I need to create a lot of permissions for the owner account"):** the owner gets a People page listing every account, can remove anyone's photo, and sees a count of goals and proof waiting in the top bar.

**Bans. Answer: "Lock out, refund their goals".**

- Owner only; the owner cannot ban themselves. A private reason is recorded with who banned and when.
- A banned person cannot sign in, bet, post goals, refill, send proof or object.
- Their open goals, and closed goals still waiting for a ruling, are cancelled and every trader refunded at held cost, because they can no longer send proof. Their drafts are rejected.
- Interpretation, flagged to the owner: a goal already ruled no longer depends on their proof, so it finishes its objection window and settles normally.
- Their bets on other people's goals stay and settle normally.
- Unbanning restores access. Cancelled goals stay cancelled.

**"Bet on literally anything." Answer: "Anything about yourself".**

- The motto is "Bet on literally anything." A goal can be anything about the poster's own life, not just grades, clubs, internships and the gym. Those four stay as quick starts.
- Unchanged: people post only about themselves, the owner approves every goal before it is public, and a goal must be something the person cannot win or lose just by deciding to.

**Stock-ticker look and live prices (technical and visual, delegated).** The goal chart gets a stock app's shape: the current price large, the change over the chosen range, and range buttons. A scrolling ticker tape of goals and prices runs across the feed. Prices refresh about every 15 seconds while a page is visible, through a read-only endpoint that records nothing, so refreshing cannot inflate the feed's view and click counts.

**Not inferred:** no per-viewer personalization, no appeals process for bans, no notifications by email or phone, no posting about other people.

## 2026-09-24 - The Kalshi direction: look, feed, goal page, account and a Running template

**User instruction:** earlier the same day, "needs to look more like kalshi, not tiktok". The owner then picked from the "Kalshi direction" page of the Mitra UI canvas (https://claude.ai/artifact/1ENk5mB8fg6zCxhwGYr7yh) and asked for it to be built: "Build the 'Kalshi direction' redesign into Mitra", with screen pictures in `Documents\Mitra design images`, the canvas boards as the exact reference, and "The people and photos in the designs are made up. Use the app's real data." On colour: "let no be red and green be yes"; the owner waved off colour-blindness caveats.

**Confirmed, in the owner's list:**

- **Look:** calm and data-first, like Kalshi's dark mode. Flat surfaces, thin dividers, no gradients or stickers. Inter with tabular numbers. The dark theme stays.
- **Colours**, replacing YES `#82a000` and NO `#796ae5`: Yes and upward moves are green `#34c77b`; No and downward moves are red `#f2545b`. Buttons always say "Yes" or "No" in words. Lime `#d2f24a` is only for main action buttons (Post a goal, Buy).
- **Feed:** framed cards, four across on a desktop and one on a phone. Each card has the person's photo as a small square at the top left, the category, the name and the question, a large "% chance" on the right, today's change and time left in small text, and Yes and No buttons showing the price. Above the cards: a slim, quiet price ticker; category tabs (Anything, Gym, Grades, Internships, Clubs, Running, Music, Closing soon); a search bar for goals and people. The desktop feed also has a featured goal with a chart and a Closing soon list.
- **Goal page:** a large "71% chance" headline with today's change, above a large line chart with 1D, 1W, 1M and All. Below: volume and close date, the rules, and proof as a dated list of the owner's verified statements. Desktop: a sticky trade panel on the right with Buy/Sell, a Yes/No toggle, an amount in points with +10, +25 and Max, a "To win" estimate and a lime Buy button. Phone: a bottom bar with Buy Yes and Buy No that opens the trade panel as a bottom sheet.
- **Prices** keep the current unit: "Yes 71¢".
- **Account page:** available points and the "Top up to 1,000" refill; positions with gain or loss since bought; the person's own goals, where a pending one says "Waiting for the owner to approve it" and an open one says "you can't trade your own goal". The header has a lime "Post a goal" button.
- **New features:** search and the new tabs; today's change on cards, the ticker and the goal page; volume ("pts traded"); "To win" and quick amounts in the trade panel; the phone buy sheet; gain or loss per position; the dated proof list; the "Post a goal" button in the header.
- **Kept unchanged:** a profile photo on every goal; no trader counts anywhere; play money only, points and never dollars; the owner approves every goal and nobody bets on their own goal; the motto "Bet on literally anything" in the header and footer; the 100-point limit per goal and two top-ups to 1,000 a month.

**Interview answers the same day** (recommended options unless stated):

- **Where search results go: "Filter the feed".** The cards narrow as you type, matching the question, the person's name or their handle. Searching from another page returns to the feed with the search filled in. No results page.
- **What "today" means: "Last 24 hours".** Today's change compares the price now with the price exactly 24 hours earlier, rolling, as the app already computed it. It does not reset at midnight.
- **The Closing soon tab: "All open, soonest first".** Every open goal, sorted by when trading closes. It is never empty.
- **How goals reach the Running and Music tabs: "New Running and Music templates"**, not the recommended "poster picks a tab". Goals in a person's own words stay under Anything; the Anything tab shows every goal.
- **Running, what counts as Yes: "Official race result only"**, not the recommended race-or-GPS option. Only a race's published results page counts; a run logged in an app or on a watch does not. **When the results list both, chip time counts; otherwise the official finish time** (asked after the first answer).
- **Music: "rremoeve this goal for now. we have an method for micro macro trades i willa d later".** No Music template for now, and **the Music tab is hidden** until Music goals exist (asked after that answer).
- **Just added, trust notes and Moving today: "Drop them, as designed".** This withdraws the Just added row decided on 2026-09-19. New goals still get the ranking's 48-hour head start. The featured goal becomes the one moving most today.

**Supersedes:** tabs by person (2026-09-19), which become tabs by category; "no search" (2026-09-19); the Just added row (2026-09-19); the validated YES and NO colours and the lime-and-violet price flashes (2026-09-22 and 2026-09-24, both delegated); the scrolling ticker tape (2026-09-24, delegated), which becomes a still row.

**Technical choices under delegation, recorded so they are not mistaken for owner rules:** a position's value is its shares at the current price, which is how Kalshi shows it and how the boards' numbers are computed; it can be more than selling would return at that moment, because a sale moves the price. The trade panel's estimate applies the market maker's formula at the current public price, so it includes price impact; the server's preview remains the exact figure. A goal with no movement in 24 hours can still be featured when nothing else moved.

**Not built, though drawn on the boards:** a Trade history link on the account page, which is not on the owner's feature list, and editing the display name, which does not exist.

## 2026-09-24 - Hosting on Vercel, private at first

**User instruction:** "need to deploy on vercel". Three questions followed; the owner's answers are quoted.

**Confirmed:**

- **Host: Vercel.** This settles the hosting question left open in D05. Which Vercel plan is the owner's choice when they create the account; the free Hobby plan is limited by Vercel's terms to personal, non-commercial use, which a play-money pilot with no revenue fits, and was pointed out.
- **Who can open it at first: "Private, share by link".** Every deployment, production included, sits behind Vercel Authentication, which is free on every plan. Testers get Vercel's shareable links. The site goes public only once email confirmation is back on, because with it off anyone could sign up with another student's `@osu.edu` address.
- **Upload sizes: "Keep 10 MB / 8 MB"**, not the recommended cap at 4 MB. Vercel refuses request bodies over 4.5 MB, so proof and photos go from the browser straight to Supabase Storage through one-time signed upload links, and the server reads each file back to check it before recording it. Nothing about who may upload, what is accepted, or what is published changes.
- **Push the code to the private GitHub repository: "Yes, push main".**

**Technical choices under delegation:** functions run in Vercel's `yul1` region (Montréal), the same AWS region as the Supabase database, since every page makes several database round trips; Node 24, as developed. Photos wait in a private staging bucket, `photo-uploads`, only until they are checked and re-encoded, then the staging copy is deleted.

## 2026-10-04 - Campus launch brand: Mitra at OSU

**User instruction:** "we're gonna make it like Mitra at OSU" and later support editions such as "Mitra at UIUC"; for the OSU launch, use Buckeye red instead of the existing lime treatment, make the interface look polished, and add an FAQ or privacy area stating that Mitra is not affiliated with OSU.

**Decision:** Mitra remains the parent product name and the first community is presented as **Mitra at OSU**. The brand layer uses a scarlet, charcoal, gray and white palette for the wordmark, primary actions, focus states and supporting surfaces. Yes remains green and No remains red because those are market semantics, not brand colors. Campus names and independence language live in one reusable configuration so a later university edition does not require rewriting shared components.

**Independence boundary:** no Block O, Brutus, official Ohio State logo, official university typeface or claim of sponsorship is used. Every page footer links to public FAQ and privacy pages and carries a plain statement that Mitra is an independent platform, not affiliated with, endorsed by or sponsored by The Ohio State University. This copy is a transparency measure, not a conclusion that the university name can be used without permission.

## 2026-10-04 - Campus-first onboarding, UIUC and verified email codes

**User instruction:** make university selection the first onboarding step, offer OSU and UIUC now, send a verification code to the university email, use an OSU-red or UIUC-orange interface according to the selected campus, lightly modernize the interface, keep the private deployment and FAQ, and describe Mitra only as an independent platform without a build-origin label.

**Decision:** sign-up begins with a choice between Ohio State and the University of Illinois Urbana-Champaign. That choice controls onboarding copy and the visual theme, but it is not an authorization fact. The server accepts an account only when the email domain matches the selected campus, and after authentication the verified email address determines the campus used by the account. OSU accepts the existing canonical `@osu.edu` identity policy (including the existing `@buckeyemail.osu.edu` canonicalization); UIUC accepts `@illinois.edu`, the address assigned to Illinois students. A display cookie may remember the campus between visits, but no security rule trusts it.

**Verification:** use Supabase Auth's supported six-digit email OTP and verification endpoint. Do not build a custom four-digit-code store: it would duplicate authentication state, reduce the code space and require new expiry, retry, replay, rate-limit and abuse controls. Sign-in and protected server boundaries continue to require a confirmed Auth identity. Actual delivery to arbitrary student inboxes is not considered ready until custom SMTP and the code-bearing confirmation template are configured and tested.

**Presentation:** OSU keeps scarlet; UIUC uses Illinois orange as its accent while Yes remains green and No remains red. Shared layouts and market mechanics remain unchanged. Public copy says Mitra is an independent platform and is not affiliated with, endorsed by or sponsored by the university named by the current campus edition. The earlier build-origin descriptor is withdrawn. This supersedes the OSU-only portion and disclosure wording of the preceding campus-brand decision, while preserving its no-official-marks boundary.

## 2026-10-04 - Signup-first private product surface

**User instruction:** the first page should be a straight signup page, should not show goals or what people are betting on, should say only **Mitra** rather than **Mitra at OSU**, and should use a subdued blue/blue-gray theme. Goal and market content belongs after signup and login; campus branding begins later.

**Decision:** signed-out `/` is the onboarding surface, not the discovery feed. It contains no live goal, market, price, position or betting/event data. The feed at `/` appears only for a verified signed-in account, and direct market pages also require that identity. Signup, signin, password recovery, FAQ and privacy remain reachable without an account. This supersedes the public signed-out feed, two-minute prompt, public market-page and search-indexing decisions from 2026-09-16 and 2026-09-19.

**Presentation:** every authentication screen uses the parent **Mitra** brand and a restrained blue/blue-gray entry palette. Selecting OSU or UIUC still validates the university email and stores the display choice, but does not repaint the onboarding screen or add an `at OSU`/`at UIUC` lockup. Campus-specific naming and colors begin only after a verified session exists. No official university marks are introduced.

## 2026-10-05 - Points-only economy and focused campus entry/feed polish

**User instruction:** show the OSU and UIUC choices in their actual colors; use Inter and related fonts with a functional-minimal, data-dense fintech direction; remove repeated play-money language; use 1,000 points; remove top-ups; reset current wallets to 1,000; group feed tabs as Competitions / Awards, Academics, Anything and Coming soon; and keep FAQ and Privacy generic rather than campus-branded.

**Decision:** the current product uses points. Each completed account receives one 1,000-point signup grant, with no user top-up and no automatic or periodic reset. Points are not currently cash or prizes. A possible later prize pool or cash product is exploratory only and is neither promised nor implemented. This supersedes the September two-refills-per-month decision and the refill portions of the 2026-09-24 interface decision.

**Presentation:** the neutral signup surface keeps the Mitra-only blue-gray frame while OSU and UIUC selectors use scarlet `#ba0c2f` and orange `#ff5f05`. Inter remains the UI/data face and Inter Tight is the related display face for major headings. Copy says "Real accountability", "Put belief behind your next move", and "A private university community for following through." FAQ and Privacy use neutral Mitra framing and a university-agnostic independence statement.

**Discovery:** tabs are Competitions / Awards (club and running goals), Academics (GPA), Anything (the full feed) and a visibly disabled Coming soon label. Other goal types remain discoverable under Anything and search.

**One-time production adjustment:** live read-only counts showed four Auth accounts, three completed profiles/wallets and one wallet at 965 points. One atomic ledger-plus-wallet adjustment added 35 points to that wallet. Verification then showed all three wallets at exactly 1,000 points and both ledger and wallet totals at 3,000 points. The fourth account has no profile/wallet and will receive the standard grant if onboarding is completed. No identities were exposed and no schema changed.

## 2026-10-05 - Browse first, Kalshi-style sign-up and onboarding, the Mitra logo, Helvetica and baby blue

**User instruction** (Mughil, the owner, after reviewing the 2026-10-04/05 signup-first build): "This is incredibley vibe coddd. frist off, we need to make tehse changes. fro the login page, users are allowed to see the marktes ont he site, and then after 30 seconds, the login popup starts liek kalshi but for our univestiy. after sign up, we need an onboarding for the user. just same as kalshi. also, restore back to old ui, wehre it was black." Designs were drawn on a canvas and reviewed before any code (https://claude.ai/artifact/CRVbTCMDaHEyE6w3sm6xkP). Answers given along the way:

- Pop-up: "Closable, like Kalshi". An X closes it and the visitor keeps browsing; it comes back as soon as they tap Yes or No or try to trade.
- Sign-in buttons: "School email only". One button per school ("Continue with Ohio State email", "Continue with Illinois email") plus Log in.
- Onboarding steps: name and @handle, profile photo (skippable until they post a goal), topics they like, and how Mitra works, plus the existing 18+ confirmation. On the name: "we need to use some software to export their name accorindg to their osu emial." (Not built yet: see below.)
- Colours: "i want baby blue for the buttons on a balck or white backgroudn depnding on users choice. then, we will choose tastefull chosen items to change accroding teot eh school they chose." Then: "the button desing is hororubke. we sneed soem ocntrast in the app,and especially when u move ur mous there should be some highlgiht animations. lets maek this tasteful adn simple."
- Final picks: "here is the logo. usehelvetica for averuthing else, and aks me if u think another font would be better somehwere else. just playuua orudn wiht the boldness or whatver whener uwant. greene red for the chart colors. school anme wit hte h colors. evyrhting else is good"

**Decision:**

- **Signed-out visitors see the markets.** The feed, goal pages and live prices are readable without an account again; trading, posting and every write still require a verified university identity. After 30 seconds a sign-up pop-up opens; it can be closed, and tapping Yes, No or a trade control opens it again. This supersedes the 2026-10-04 "Signup-first private product surface" decision. Goal pages stay marked no-index until the owner decides about search engines again.
- **Sign-up in Kalshi's shape:** one screen per step with a progress bar: school email, the six-digit code, then a password. The code proves the person owns the inbox before the account can be used.
- **Onboarding after sign-up:** name and @handle, 18 or older, profile photo (skippable; still required before posting a goal), topics to follow, how Mitra works. Topics are stored with the profile; nothing uses them to change the feed until the discovery decision (D08, D09).
- **Look:** black by default with a white theme the person chooses (remembered per browser); baby blue main buttons; green Yes and red No, including the two-line Yes/No chart; higher contrast throughout; quick, simple hover and press feedback, with movement removed for people who ask their device to reduce motion.
- **Logo:** the owner's lockup (the symbol with MITRA), supplied as an image on 2026-10-05 and traced to a vector so it stays sharp and can be recoloured for the white theme. The symbol alone is the app and browser-tab icon.
- **Type:** Helvetica for everything. The owner then supplied a free-font-site "helvetica-255.zip"; its files are Apple's and Adobe's licensed copies with no web licence, so they were not used, and the owner chose a free look-alike over Adobe Fonts or buying a licence: devices without Helvetica (Windows, Android) get TeX Gyre Heros, self-hosted under its free licence. Apple devices keep their own Helvetica Neue.
- **School touch:** the school's name beside the logo in the school's colour once someone is signed in ("MITRA | Ohio State" in scarlet, "MITRA | Illinois" in orange, each adjusted where needed so it stays readable on black and on white). The full scarlet and orange page themes of 2026-10-04 are withdrawn; buttons are baby blue for everyone. No official university marks.
- **Kept:** points only (1,000 at sign-up, no top-ups), the feed tabs plus Closing soon, the owner's approval of every goal, no betting on your own goal, the 100-point limit, photos on goals, and the independence statement in the footer.

**Not built, and why:** filling in the name from the university directory. The lookup could not be checked from the development machine on 2026-10-05, and it sends the student's address to a university service, which needs the owner's explicit go-ahead. The name step starts empty for now.

## 2026-10-05 - Self-service account deletion and existing-account feedback

**User instruction:** fix signup, say when an account already exists, and "create a crud thing so delete acc also."

**Existing account:** the current email-code signup deliberately does not reveal whether an address exists before inbox ownership is proven. After a returning member enters the valid six-digit code, Mitra signs them in and displays, "This account already exists, so we signed you in." The email step also keeps a prominent "Already have an account? Log in" action. Provider rate limiting has a distinct wait-and-retry message.

**Deletion:** the account page exposes one permanent-delete operation with typed `DELETE` confirmation. The owner account cannot self-delete until ownership is transferred. Draft, open and closed goals owned by the person are cancelled and every participant is refunded at held cost. Ruled and settled goals stay final. Private evidence originals, profile photos and temporary photo uploads are removed; evidence statements, links, captions and review notes are cleared into a dated tombstone; the profile is anonymized; and the Supabase Auth identity is deleted. Trades, ledger entries, wallets, rulings and audit records remain as anonymized accounting history. This implements the proof and photo deletion decisions from 2026-09-19 and 2026-09-24.

## 2026-10-07 - Bound feed measurement, expire upload grants, and isolate the adjudicator

**Security remediation within recorded product decisions:** preserve the no-viewer-identity choice in D08/D09, but stop signed-out page reads from writing analytics. Signed-in feed exposures and market opens use anonymous market/hour counters only: at most 500 exposures and 3 opens per market per hour, with only the latest 24 hours used for ranking and new counters pruned after 24 hours. This is a technical guardrail, not a new attribution or personalization policy; legacy `feed_events` rows are retained but are no longer used for ranking.

Every direct-upload URL now has a server-side per-user intent, expires after 48 hours, and is limited to two pending photos or five pending evidence uploads per user; pending evidence is also bounded to ten per market including completed evidence. An authenticated daily maintenance route removes only expired, unreferenced objects through Supabase Storage and then removes their intents. It never deletes completed evidence. Vercel requires `CRON_SECRET` to be configured for this route; missing configuration fails closed.

The outcome-controlling owner cannot buy or sell any market, including when replaying a trade confirmation. Existing owner positions are not liquidated by this security change; no owner positions were modified as part of the code patch.
## 2026-10-06 - One consistent UI system

**User instruction:** the owner shared a post, "5 things that actually made my vibe coded projects not look like vibe coded projects" (pick one font and one accent colour; give the AI your existing component before asking for a new one; real empty states that say what to do next; decide mobile early; one animation used consistently), and asked "can u make this".

**Decision:** Mitra follows those five rules, and they bind every agent (AGENTS.md, UI rules; docs/DESIGN.md section 13). Applied without changing the owner's earlier choices: Helvetica at weights 400 and 700 only; baby blue as the one accent, with green/red, danger/success and the school's name colour as the only other colours; one button system; a shared empty state everywhere a list can be empty; mobile first, checked at 375, 768 and 1440 pixels; one entrance animation (a short fade) plus the shared hover and press feedback.

**Reversed the same day, except the fonts.** After seeing it, the owner: "go back to the old app. i just sent that to mak ti not liek vibecoded. i liekd the how the makets and evyerhitgn looked. just he fonts and shit bro. chang eevyerhting back but hte fonts and shiet". The button system, empty states, tablet layout, fade-in, colour tokens and the AGENTS.md and DESIGN.md rules were undone; what stays is Helvetica at weights 400 and 700 only. The look is the 2026-10-05 one (DESIGN.md section 12).

## 2026-10-08 - Pivot: campus event markets instead of people's goals

**User instruction** (the owner, sharing `Mitra_Event_Market_Pivot_Coding_Agent_Prompt.pdf` from their OneDrive and an image of a card reading "mitra." / "Trade on what happens here." / "Ohio State" / "Your campus. Your market."): "need to change the site to this now".

The brief (one page) asks to refactor the existing app, not start a new one: the organizing unit changes from people and their goals to verifiable local events and business metrics, launching at Ohio State with room for more campuses. It lists a campus home feed (question, venue, category, chance, activity, closing time), a market page (question, event and venue, exact Yes/No rules, trading cutoff, verification source, price history, trade ticket), discovery by category (Nightlife, Food, Events, Entertainment, Campus), venue, status and closing date with a venue page, a portfolio linked to event markets, and a student "suggest a market" flow that waits for review and never publishes itself. It asks for three hypothetical OSU sample markets (Midway on High drinks on a Friday night, Buckeye Donuts donuts overnight, a Gateway Film Center screening's paid admissions), visibly marked as sample data, never presenting invented sales, attendance, partners or volume as real. Entities: campus, venue, event, market, proposal, resolution source, and statuses draft / pending / open / closed / resolved / void, each market with precise outcome conditions, time window and time zone, cutoff and data source. Keep accounts, profiles, the logo, colours, authentication and the portfolio; remove predicting individuals; points only; avoid anything that encourages altering a venue's sales or attendance to win. It says to make reasonable assumptions and to separate placeholders from working integrations.

Answers to four questions asked before building:

- **The live goal market** (one open, two people holding positions): "Cancel + refund". It is voided through the existing cancellation, which refunds held cost; its link keeps working and shows it as void.
- **Sample markets on the live site:** "Live + tradeable". Labelled as samples that are hypothetical and not verified by the venue. When real markets replace them they are voided and refunded.
- **When a market's data never arrives** (for example, the venue never shares its count): "Resolves No", the same rule goal markets had. The owner still settles every market by hand from its named source.
- **Deploying:** "Show me first". Build and verify locally, then wait for the owner's go-ahead before pushing, touching the live database, seeding samples or cancelling the old market.

**Decision:**

- Markets are about events at venues, grouped by campus. Goal markets, templates, proof uploads by a goal's subject and person-based cards are removed from the product. Accounts, profile photos, the 1,000-point grant, the 100-point per-market limit, selling, the market maker (b = 150), owner approval of every market with an opening price, rulings with a 24-hour objection window, payouts and refunds stay.
- Students suggest markets; a suggestion is pending until the owner publishes it as a market (with exact terms and an opening price) or turns it down with a reason the student can read.
- Every published event market names its resolution source, which says whether it is a working data feed or a placeholder that no agreement or integration yet backs.

**Assumptions made under the brief's "make reasonable assumptions"** (the owner can change any of them): trading cuts off when the event window starts unless the owner sets another time; results are due three days after the window ends, after which a market with no data is ruled No; the feed shows the viewer's campus, and visitors see Ohio State; venue staff and owners are asked not to trade their venue's markets, and nobody may buy at a venue to move a market, as published rules rather than an enforced check; the brief's internal statuses map onto the existing ones (pending = a suggestion under review, resolved = ruled and then settled, void = cancelled).

**Go-ahead, the same day:** after reviewing the local build and its screenshots, the owner, asked which of the two owner accounts (@ducky, @mitrapredict) the voided goal market and the samples should be recorded under: "record it under both accounts. push". An audit record names one acting account, so @mitrapredict acts and every record's reason names both accounts.

**The Midway on High sample stays.** Asked whether a market on a bar's drink count suits members who must be 18 or older but may be under 21: "its 18+". The sample stays live as published; Mitra's audience remains 18+ by self-confirmation, with no 21+ gate on any market.

**The opening card is removed (2026-10-08, after go-live).** Sharing a screenshot of the live home page's "mitra." card: "remove this as well". The card goes; the motto stays in the top bar and footer, and the price ticker stays.

## 2026-10-09 - XO Market and Kalshi type, smooth loading, short titles, Brutus instead of the screening

**User instruction** (the owner, with screenshots of the live feed, XO Market and Kalshi): "use claude design, the fonts look to ass and hthign and weirdlypalced. follow the two screenshots. fix the fonts and animations wehn the site loads and stuff, use clade dsing for that,t ehse apps are very smooth,t hast eh main issue. also. there is too many words per event. Will midway on high sell drinks from 2am to 9pm jesus bro thats horribe. If you are logged into the Ohio state thing, then say will Midway on high sell morre than XYZ drinks, and then when they click on the card it shows the full line of whatevr u originall wrote. and remove the dumbass will gateway film center. maybe do Will Big Red come to smith steeb hall or some shit. get to work"

**Decision:**

- **Type follows the two references.** Geist replaces Helvetica (the 2026-10-05 and 2026-10-06 type rules are superseded), at 400, 500 and 600, with small-capital category labels, semibold titles and numbers, and tighter large type. Geist was chosen over Inter while drawing the canvas: Inter reads as the generic default, Geist is a Swiss-style grotesque in the spirit of the Helvetica the owner picked, renders crisply on Windows, and has tabular figures. Layout follows the references too: the featured market in two columns, text tabs with an underline, filled Log in, and cards that open the market wherever they are tapped.
- **Smooth loading:** loading screens the moment a link is tapped, content rising into place, the chart drawing in, the tab underline sliding, no font jump, and no movement for people who ask their device to reduce motion. Designed on a Claude Design canvas first: https://claude.ai/artifact/RhETGs9cAoH5mMZDk4eNXm. Details in DESIGN.md section 14.
- **Short titles:** every card shows a few words ("Will Midway on High sell more than 1,000 drinks?"); opening it shows the full question as written. The short title is display only: the question, rules and Yes/No conditions that trade are unchanged and stay frozen. Read "if you are logged into the Ohio State thing" as Ohio State's edition, where every market is today; short titles show for visitors and members alike.
- **The Gateway Film Center sample is retired** (voided; nobody held a position on 2026-10-09) and replaced by **"Will Brutus visit Smith-Steeb Hall?"**, hypothetical and labelled Sample like the others: Brutus in costume inside or at the entrance of Smith-Steeb Hall between 8 AM and midnight on the Saturday, shown by a dated post from an official Ohio State or Brutus Buckeye account; trading until 8 AM that day; opening at 30%; a placeholder source.

**Assumptions to confirm:** the owner wrote "Big Red"; Ohio State's mascot is Brutus Buckeye ("Big Red" is Cornell's and Western Kentucky's), so the sample names Brutus. The 30% opening price and the 8 AM to midnight window were chosen for the sample; the owner sets opening prices and can change either.

**Not live yet:** the live steps (migration 0014, the two short titles, voiding the screening, publishing the Brutus sample) run with `scripts/sample-refresh-go-live.mjs --apply` on the owner's go-ahead, before the code is pushed, because the new code reads the new column.

**Going live (the same day).** The owner: "push". GitHub's main then held Siyansh's 2026-10-08 merge of a 2026-10-07 security remediation, which had left conflict markers in source files and never built. Asked how to handle it: "Undo their merge, push mine". Main's files went back to the last good version in a new commit, with nothing deleted from history; the remediation waits on its own branch to be merged into the event-market app properly. The owner pushed without changing Brutus, the 30% opening or the window, so those went live as built.

## 2026-10-10 - The Midway on High sample is the home page's featured market

**User instruction** (the owner): "change the event displayed on the homepage to thte midway one".

**Decision:** the owner can pin one market to the featured slot at the top of the home page. While the pinned market is open in the feed being shown, it is featured, with its chart and Yes/No, whatever moved most; the grid's ranking, Closing soon and the ticker are unchanged. Once it closes, or when nothing is pinned, the featured market is again the one moving most today (2026-09-24). The pin is the Midway on High sample, so it ends by itself when Midway's trading closes on October 16 at 9 PM. It is kept in `src/config/featured.ts`, so changing it means asking for a one-line change and a deploy; an owner button can come later if pins change often.

## 2026-10-12 - Missing data is void/refund; dual-token sweepstakes remains unapproved

**User direction:** a venue's failure to provide results must never be treated as an automatic No. The sweepstakes concept under consideration separates nonredeemable Gold Coins (possibly sold in packages) from redeemable Sweepstakes Coins; purchases might include bonus Sweepstakes Coins, and users might also receive Sweepstakes Coins through a free alternative entry method and win more through event predictions.

**Implemented product rule:** silence or unavailable source data is not evidence of either outcome. Once the published results deadline passes, the owner may void the market, ending it and refunding each position's remaining held cost basis. A Yes/No ruling must be based on the named source and frozen criteria. This replaces the event-market missing-data rule and UI language chosen on 2026-10-08.

**Sweepstakes status: exploratory, not approved or implemented.** Today's product remains the free, nonredeemable 1,000-Point prototype. Gold Coins, Sweepstakes Coins, paid packages, bonus issuance, prediction-based awards, alternative entry, conversion and redemption do not exist in code or schema. This is not a legal workaround and does not establish that Mitra may offer an unlicensed event market. A genuine free-entry method may be relevant to state promotion/gambling analysis, but its nominal existence is insufficient: purchase linkage, relative difficulty, presentation, practical equivalence and real user behavior matter. If Mitra markets a free route as equal while making it materially harder or misleading, that itself creates consumer-protection risk.

**Legal gate before any value-bearing prototype or launch:** obtain a written opinion from counsel with sweepstakes/gaming and derivatives experience, specifically addressing (1) consideration, chance, prize and indirect purchase linkage for the exact user journey; (2) an actually free, comparably accessible entry route and disclosures; (3) state-by-state availability, registration, bonding, age, geolocation and prize rules for Ohio, Illinois and every proposed market; (4) whether event-outcome contracts require CFTC-regulated exchange/clearing arrangements regardless of token names or AMOE; (5) whether any token, promise, revenue share or marketing creates separate securities or consumer-protection exposure; and (6) tax, payments, AML/KYC, custody, privacy and dispute handling. Do not code or advertise this as legal until counsel signs off on both rules and product UX. We will not design a merely technical or intentionally burdensome free-entry route to evade gambling restrictions.

**Campus QR variant: proposal, not approved.** The owner suggested on-campus representatives or posted single-use QR codes, with an account award after a location check, instead of mailing an entry. This does not “perfectly satisfy” an AMOE requirement by itself. A campus-only physical step may make the no-purchase route materially less accessible than the paid path and could exclude otherwise eligible users; whether that is legally acceptable depends on the promotion, states, and actual operation. GPS can also collect sensitive precise-location data, which creates a separate consent, minimization, retention, security, and privacy-policy burden. OSU's rule 3335-13-01 restricts canvassing/solicitation for sales on university property absent written permission; posting/distributing QR codes needs campus-specific approval, not an assumption of permission. No GPS, QR award, representative tooling, Sweepstakes Coins, “free entry” website copy, or compliance claim is approved for implementation. If counsel later approves a route, it must be genuinely available and clearly disclosed—not merely technically possible—and the product must not imply purchase improves odds or is needed.

**External primary references reviewed 2026-10-12:** CFTC, [Understanding Prediction Markets and Event Contracts](https://www.cftc.gov/LearnandProtect/PredictionMarkets) and its 2026 [Prediction Markets proposed-rule notice](https://www.cftc.gov/LawRegulation/FederalRegister/proposedrules/2026-05105.html); FTC, [Advertising FAQs](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business), [PCH sweepstakes dark-pattern enforcement](https://www.ftc.gov/news-events/news/press-releases/2023/06/ftc-takes-action-against-publishers-clearing-house-misleading-consumers-about-sweepstakes-entries), and [X-Mode/Outlogic location-data order](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-order-x-mode-successor-outlogic-prohibiting-it-sharing-or-selling-sensitive-location); [Ohio Revised Code 2915.01](https://codes.ohio.gov/ohio-revised-code/section-2915.01) and [OSU Rule 3335-13-01](https://trustees.osu.edu/bylaws-and-rules/3335-13); [Illinois 720 ILCS 5/28-1](https://www.ilga.gov/Documents/legislation/ilcs/documents/072000050K28-1.htm); and the SEC/CFTC joint [2026 interpretive release on securities laws and crypto-asset transactions](https://www.sec.gov/rules-regulations/2026/03/s7-2026-09). This is a product risk screen, not legal advice or a state-by-state conclusion.

**Existing-market boundary:** the three sample markets were published and are tradeable with frozen terms. Their stored terms are not silently rewritten by this code change. Before deployment, review those live markets and decide whether to leave the originally published terms in place or void/refund them and publish corrected replacements; do not alter terms after trades have been placed.

## 2026-10-12 - Silver offers, Gold Trade Coins, campus QR awards, and production reset

**User direction:** implement the separate-currency design rather than leave it as a benchmark. A user purchases a cosmetic badge that includes Silver Coins: 100, 200, 300, 400, 500, then increments up to 1,000 Silver at $1 per 100 Silver. A successful, verified payment earns an equal amount of Gold Trade Coins. Before payment, the offer summary must disclose the badge, Silver amount, Gold bonus, price, and intended uses. Payment processing remains a placeholder until connected; it must fail closed. No withdrawals or cash/prize redemption are part of this implementation.

**Free campaign awards:** owners may configure campus QR campaigns with the campus, award amount, location, radius, and availability/use limits. Claiming requests device location, validates it on the server against the campaign location, and awards Gold at most once per eligible claim. Claimant coordinates are transient and must not be written to the database, logs, analytics, or error reports. Campaign reference coordinates and claim/audit records are retained. This is a product requirement, not a conclusion that the campaign satisfies any legal alternative-entry rule; the product must not call it legally compliant or a guaranteed safe harbor.

**Balances and trading:** the existing 1,000-point starting balances are removed, never converted. Existing owners are retained with zero starting Gold after the reset; future accounts start with zero Gold. Gold Trade Coins fund market trades and remain nonredeemable. Silver Coins are a separate balance used only for disclosed cosmetic/premium products; do not treat Silver as trade collateral. Account UI uses the explicit currency names and never relabels old points as cash.

**Public browsing:** signed-out visitors may choose OSU or UIUC from a campus selector and browse that campus's public markets. Signed-out users cannot trade. Signed-in users always see their verified campus; a query parameter cannot change their trading campus.

**One-time production reset authorized:** retain the two existing owner accounts only (`murugan.23@osu.edu` and `predictmitra@gmail.com`), retain all five market definitions and their published terms/statuses, erase all existing account ledger history, delete every other account and its dependent personal/account records, remove all current trades and positions, restore each market's price state to its stored opening state, and replace past price history with one opening-price point. Keep reference market/event/venue/source records. Make a scoped pre-reset export before changes, clean up owned private storage through Storage APIs rather than SQL, and verify final counts and identities. Do not alter market text/statuses, perform a production schema migration, deploy, or connect payments as part of this reset.

**Owner clarification, 2026-10-13:** Keep the five market questions/terms but remove all market activity and effects: zero every owner's and retained account's coin balance, remove trades/positions/volume-driving activity, and delete all historical price/feed/audit/claim records without inserting replacement historical points. Keep the two owners only; remove all other account identities, profiles, and owned personal storage. New signups must receive zero coins. This supersedes the earlier instruction to leave one opening-price history point. The connected deletion tools are currently unavailable, so do not execute a partial production reset.

**Supersedes:** the 2026-10-12 section above describing dual currencies and campus QR as merely exploratory proposals. The remaining legal/privacy risk notes still apply: currency names or an on-campus QR method alone do not establish legality; no compliance guarantee is authorized.

**Owner clarification, 2026-10-12:** visible product language uses **Coins** for the cosmetic/shop balance and **Trade Coins** for the market balance. Do not show “Silver” or “Gold” in customer-facing screens, FAQ, or account flows; those remain internal legacy column/variable names only. The shop presents one Mitra badge with selectable levels tied to the Coin amount, with Coins and the before-payment Trade Coin bonus as the primary offer information and the badge as secondary. Keep price, bonus, and intended-use disclosure before payment; checkout stays disabled until payment and fulfillment are actually integrated. QR campaign links should render locally as downloadable QR images in the owner console. The same campaign link may be claimed once per eligible account, subject to campaign caps; it is not a globally single-use QR. Device location can be spoofed, so do not claim QR/GPS proves physical presence or legal compliance.

## 2026-10-13 - Neutral opening odds and owner campus browsing

**Opening odds:** owners do not set them. Every newly published market starts at 50/50 (5,000 basis points), with equal initial LMSR shares and a 50% opening price. This is enforced in the publishing service, not only hidden in the form; unexpected client-supplied odds are ignored. New sample markets receive no synthetic pre-trade price history. Price changes come from trading. Existing published market terms and states are preserved by this product change.

**Owner storefront browsing:** both owners may switch the campus storefront between Ohio State and Illinois. The preference changes only what the owner browses; it never changes their verified university identity or the campus required for members to trade. Ordinary signed-in members remain pinned to their verified campus.

**Production reset remains pending:** retain both owner Auth accounts and all five market definitions/terms/statuses; remove all non-owner Auth identities and associated account/personal data; zero all wallets; clear trades, positions, volume-driving market state and all historical price/feed/audit/claim records; preserve reference market/event/venue/source records. No replacement price-history points are inserted. The connected tools lack supported Auth and Storage deletion operations and no scoped export was created, so no part of this production reset was executed.

**Reset follow-up, 2026-10-13:** the user confirmed their private backup/export and manual non-owner Auth/Storage deletion. After verifying only the two owner Auth identities remained, the remaining database reset was authorized and executed transactionally. Existing markets' initial/current shares are zero and opening probabilities are 50/50, superseding the earlier instruction to restore unequal historical opening odds. Market definitions, terms, deadlines, and statuses remain unchanged. New owner activity after this one-time reset is not automatically erased or disabled.

## 2026-10-13 - Campus-branded verification emails

The owner requested Mitra branding and Ohio State/Illinois accents on verification emails. Use a baby-blue Mitra wordmark, readable large OTP, Helvetica, and an independent-platform footer. School selection in validated signup metadata controls email appearance only; account/campus authorization still derives from the verified mailbox. Show neutral branding when metadata is missing or unknown, with an Ohio State fallback for the two retained owner mailboxes. Do not change SMTP credentials, email security, or code expiration as part of this presentation change.

## 2026-10-19 - Pivot: founder videos and startup prediction markets

**User instruction** (the owner, pasting a full brief titled "MITRA — COMPLETE STARTUP PREDICTION MARKET PIVOT", two screenshots of cards, and a new logo file `Mitra.svg`): "Ignore the stuff about how the app looks in the prompt above, for the design consult this paragraph below. The design should be the exact same vibe and animations as the current mitra, except the physical cards (so the markets) are going to be changed. I've attached two screenshot examples of what a great card looks like, try your best to get as identical to those as possible. if you need ai gen images for thumbnails lmk. important thing is its that the charts should be there, the video thumbnail should be there, and the line (so what the market is). I've also attached the new mitra logo, so use that and replace all the prev logos with the new one I've attached as an svg file. and get to work" (spelling tidied).

**The brief, in short.** Mitra becomes "YouTube/TikTok for discovering emerging founders, combined with prediction markets on their startups' futures": discover a founder's video, learn about the startup, read its market's price history, take a virtual Yes or No position, follow the founder. Three systems: a discovery engine (a personalised video feed built on recorded engagement, with candidate generation, a configurable weighted ranking, cold start for new viewers and new videos, exposure for unknown founders, exploration), an information engine (founder and startup profiles, videos, descriptions, milestones, updates, verification), and a prediction engine (several Yes/No markets per startup on objectively measurable milestones, virtual credits only). It specifies the feed card (video, founder and company, the market with chance, a compact chart, Yes and No prices, volume, close date; like, comment, share, save, follow founder, follow startup, not interested, report), the expanded market page in a fixed order (thumbnail and video; question and chance; a large chart with 1D, 1W, 1M, 3M, 1Y, ALL, tooltips and optional volume bars; description; statistics; trading with contract quantity, balance, cost, payout and profit or loss; resolution criteria; discussion), startup and founder profiles, a portfolio, a market directory with search and filters, creator tools for founders (who must never manage or resolve their own markets), owner tools (approvals, video review, demo markets, rules before activation, pausing, evidence review with four verification levels, resolution, moderation, audit), 15 to 20 fictional startups and 30 to 40 fictional markets labelled as demo data and stored in the database, migrations that keep existing records, no real money, and existing secrets untouched. Financial-milestone markets (revenue, Series A, valuation, acquisition) are demonstration only and need separate legal review before any real-money use. The recommendation must never promote or suppress founders to influence a market, and must not use positions, market-maker interest or trading exposure.

**Decision:** build the brief in this codebase with the existing look; only the cards change, to the owner's screenshots, with the video thumbnail, the chart and the market's question all present. The owner's new logo replaces the old one everywhere, including the tab and home-screen icons.

**Assumptions made to keep building (the owner can change any of them):**

- **Thumbnails.** The brief allows a composite drawn from the founder's portrait, the startup's logo and a product picture when no thumbnail is supplied. Demo startups use that composite, laid out like the owner's first screenshot (portrait or initials with name and role beside a product panel); a real thumbnail or photo, like the second screenshot, replaces it whenever one is supplied. AI-generated founder photos can be added later on the owner's say-so.
- **Videos.** Demo videos have no files. Their players work (play, pause, progress, sound, captions) over the composite with the founder's captions, as the brief's "working placeholders", and record watch time like a real video; a real video file plays when one is supplied.
- **Credits.** The brief and the first screenshot say credits, so the points are now called credits. The economy is unchanged: 1,000 credits once at sign-up, no top-ups, at most 100 credits of held cost per market, the market maker at b = 150, selling allowed, no cash value.
- **Who trades and who signs up.** Accounts, sign-up and sign-in stay as they are; the campus names leave the top bar and footer. Founders, and the account that registered a startup, cannot trade that startup's markets (the existing rule that nobody trades a market they influence).
- **Who creates what.** Any member can make a founder profile and register a startup; both, and every uploaded video, wait for the owner's approval before anyone else sees them. Only the owner creates, edits before opening, pauses, settles and voids markets; a founder can suggest one for review.
- **Measurement.** Per-viewer engagement is recorded to personalise the feed, as the brief asks (this replaces the 2026-09-19 rule that feed counts carry no viewer identity): signed-in members by account, visitors by a random first-party cookie with no personal data. Prices, positions and trades are never ranking inputs.
- **Event markets retire.** Venue pages, the event suggestion form and campus wording leave the interface; past event markets keep their pages. The three live event samples are voided with refunds when the startup version goes live.
- **Going live** follows the 2026-10-08 rule: build and check locally, then wait for the owner's go-ahead before pushing, migrating the live database or seeding demo data there.

**Added while building (2026-10-19), for the owner to confirm or change:**

- **Trader counts.** Cards and market pages show how many people traded, as the brief's statistics ask; never who.
- **Sign-up topics.** The onboarding topics are now the startup industries, and the ones picked seed a new member's feed (the 2026-10-05 rule that topics change nothing no longer holds).
- **Owner trading.** The owner accounts can still trade, as before; the block in the unmerged 2026-10-07 remediation is not part of this change. A startup's founders and its registrant are blocked.
- **Uploads.** Founders paste links to photos and videos until the owner creates the storage buckets and turns uploads on; uploaded images are re-encoded to strip metadata, and videos are stored as sent under unguessable paths and shown only once approved.
- **Retired event markets** are voided at go-live with the reason "Mitra moved from campus event markets to startup markets on October 19, 2026, so this market was voided and everyone was refunded what they paid."

## 2026-10-19 - The startup pivot rebuilt on the 2026-10-12 line

**User instruction** (the owner, shown that `origin/main` had been rebuilt by Siyansh on 2026-10-12 and 13 while the pivot was built on the older line): "Rebuild the startup pivot on top of Siyansh's origin/main: keep their security, email and account work, renumber the startup migration after 0017, and show me what of their campus features would carry over before pushing anything."

**Decision:** the pivot is ported onto that line on the branch `startup-pivot`. Its security, email, account and provisioning work is kept as built, and its recorded decisions of 2026-10-12 and 10-13 override this file's 2026-10-19 assumptions where they differ: the market balance is **Trade Coins** (zero at sign-up, awarded by QR campaigns or as the bonus on a paid Coin bundle, whose checkout stays off) instead of 1,000 free credits; **Coins** are the separate shop balance; every market opens at **50/50**; missing source data **voids** instead of resolving No; the owner accounts **cannot trade**. The startup schema is migration 0018.

**Campus features, for the owner to confirm before anything is pushed** (as built on the branch):

- **Kept:** QR campaigns and their claim page (the only way a new member gets Trade Coins today); the shop with checkout off; campus-branded verification emails; the owner trading block; bounded, signed-in-only market counters; upload intents and the daily maintenance route (`CRON_SECRET`), now also covering founder uploads.
- **Retired from the interface:** the signed-out campus picker and the owner's campus switch, because startup markets have no campus; their components are removed, while the campus cookie that brands sign-up emails stays.
- **Unchanged and still campus-bound:** sign-up admits Ohio State and Illinois mailboxes only, and QR campaigns are per campus.

**Where the pivot still differs from the 2026-10-07 guardrail, for the owner to decide:** signed-out visitors' video events are recorded under a random cookie so the For you feed can learn (this file, 2026-10-19), now capped at 400 per hour and deleted after 60 days. The 2026-10-07 rule kept signed-out page reads from writing anything; making the video feed learn only from signed-in members is a small change.

**Open, because of zero-start:** a new member can watch, follow and comment but cannot trade until they claim a QR award. Whether startup markets need another way to get Trade Coins (a starting grant, a free daily amount) is the owner's decision.

**Owner's answer, 2026-10-20:** "The carry-over list looks right as built. Keep zero starting Trade Coins and the visitor video learning as they are. Next, help me go live: run the read-only go-live report first." The carry-over above stands as built: new members start with zero Trade Coins, and signed-out visitors' video events keep teaching the feed under the cap and 60-day deletion.

## 2026-10-20 - Look like YouTube, not TikTok

**User instruction** (the owner, after the startup pivot went live): "well we need it to look different for phone and desktop right. for desktop i want more of the og mitra style, so a big highlight market and then other markets below like how it was before. i have a feeling it should be similar to that on phone as well, maybe something intensifying the highlight market". Asked where the swipe feed should go: "i dont get it. we aren't trying to become tiktok here. we are trying to become youtube. im going to give you what youtube UI looks like copy that"; the highlight: "Moving most today"; the phone: "going to give you what youtube looks like on phone and computer and u just copy". Then four screenshots of YouTube's home: a desktop with the guide on the left, a chips row and a three-column grid whose first slot is a sponsored video with two buttons; a phone with the logo and icons on top, chips, full-width videos (the first playing muted with captions), a shelf with Explore more, and Home, Shorts, Create, Subscriptions and You along the bottom (spelling tidied).

**Decision:** the home page copies YouTube's home on both sizes, in Mitra's colours, font and motion. The swipe-through video feed is retired.

**Assumptions made to copy it (the owner can change any of them):**

- **Cards are founder videos with their market.** YouTube's home is a grid of recommended videos, so Mitra's is the recommended founder videos (the same For you ranking, which still never reads market data), each card showing its startup's market: the thumbnail with the video's length, the founder's avatar, the market's question as the title, the startup and founder as the channel, and a row with the chance, today's change and the price chart, then Trade Coins traded and the close date. A video without a market shows its own title.
- **The highlight is the first card**, where YouTube puts its sponsored video: the market moving most today (a pinned market if one is set), labelled "Moving most today", with Yes and No pill buttons under it as YouTube has Watch and Watch now. On a phone it plays its founder video muted with captions, as YouTube's first video does.
- **Desktop guide** (YouTube's left column): Home and Markets (Markets in YouTube's Shorts place); Following, with the founders you follow (YouTube's Subscriptions); You: portfolio, activity, your founder page, account; Explore: the industries; owner tools for the owner. The hamburger narrows it to icons; on narrower screens it opens as a drawer.
- **Chips** (YouTube's topic row): All, Following, New, Closing soon and the industries, filtering the home grid.
- **One shelf**, as YouTube's: markets closing soon, scrolling sideways, with Explore more opening the market directory.
- **Phone bar** (YouTube's bottom bar): Home, Markets, Create, Following, You. Activity is the bell at the top; search is the magnifier.
- **The market page is Mitra's watch page.** A card opens its market (video first, then the market). `/following` shows the same grid for followed founders; `/watch/<id>` opens that video's market.

## 2026-10-20 - Mitra's own website: Vela's look, XO Market's motion

**User instruction** (the owner, with screenshots of velaenergy.ai's Company page and xo.market's home page, and the logo file `Mitra.svg`): "need to create a website for mitra. i want the vibe to be more of vela, but the animations and stuff for xo.market thats th website. can u see the animations? go look the vela thing is velaenergy.ai" (spelling tidied). Asked three questions, the owner chose a **separate website** ("its own project and web address, kept apart from the app, like xo.market and XO's app"), **the lotus, animated** for the opening screen ("on black, Mitra's lotus slowly reveals itself and breathes behind the headline, over a faint moving field of market lines"), and a **founders section** ("I build the section, and you send each founder's name, role, photo and a few lines of bio"). Told that Siyansh's paused exchange work (top of this file) swaps Trade Coins for a dollar exchange, the owner chose **neutral words for now**: "Founders, their videos, and Yes/No markets on their milestones, with clear rules. No currency is named, and example markets are labelled Demo with no prices or volumes."

**Decision:** a marketing site for Mitra, separate from the app, with Vela's look (black and white, a full-screen opening, very large tightly set headlines, a floating pill menu, white space with thin rules, a black footer) and XO Market's motion (smooth scrolling; sections that slide up over the one before as round-cornered sheets while it sinks and dims; headlines that rise into place line by line; an animated field behind the opening that drifts and fades as you scroll away; cards that fade in from a blur; a top bar that takes the colour of the section under it; a footer uncovered from underneath at the end). Its main button opens the app.

**Assumptions made to keep building (the owner can change any of them):**

- **Where it lives.** Its own Next.js project in this repository's `site/` folder, with its own packages, to be deployed as a second Vercel project (Root Directory `site`) at its own address once the owner creates one. The app is untouched apart from its type check, linter and styles skipping `site/`.
- **Words.** Currency-neutral, per the owner's answer: no Trade Coins, dollars, prices, chances, volumes or trader counts, and nothing says trading is open to everyone. Example markets come from the app's fictional demo catalog and carry a Demo label. Every statement holds under both the live rules and the paused exchange plan: founders post videos the owner approves; each market's Yes and No conditions, source and close date are written before it opens; founders cannot trade their own startup's markets.
- **Founders.** The section is built now. Until the owner sends names, roles, photos and bios it shows labelled empty places only on the owner's machine (`next dev`) and is left out of the published site, so nothing is invented.
- **Type and colour.** Geist at 400, 500 and 600, as in the app (AGENTS.md); black, white and a light grey, with green for Yes and red for No in market pictures.
- **Going live** follows the 2026-10-08 rule: built and checked locally; nothing is pushed or deployed until the owner says so.

**Owner's go-ahead, 2026-10-20 (evening):** "go", in answer to "To put it online, say go and I'll push. Then you'd create a second Vercel project from this repo with Root Directory set to `site`, and pick its web address."

# Current catalog follow-up — 2026-10-20

The owner first requested nine current markets, then clarified a few per category rather than exactly nine. Keep two existing open markets per startup industry (20 across ten industries) in the existing video-first UI despite empty liquidity. Keep both Yes/No inspection controls, honest No offer/zero-volume states, and closed customer execution. Other definitions are hidden reversibly, not deleted. “Codex funding/credits running out” refers to coding-agent usage, not authorization to enable app funding.

## 2026-10-21 - mitra.market: the website at the root, the app at app.mitra.market

**User instruction** (the owner, after asking where Open Mitra would go once the site had a domain and being told the usual setup is one domain with the site at its root and the app on an `app.` subdomain): "im buuing it thru cloudfare. do i get the sub domain for free", then "mitra.market i boguht it this is my domain help me out and finish it" (spelling as written).

**Decision:** the website is served at `mitra.market`, with `www.mitra.market` redirecting to it; the app at `app.mitra.market`. The site's Open Mitra and its other app links go to `https://app.mitra.market`. The domain was bought through Cloudflare, so its DNS stays at Cloudflare, with the records Vercel asks for set to DNS only (no Cloudflare proxy), as Vercel requires.

**Assumptions made to finish it (the owner can change any of them):** the app's own address for sign-in and password-reset emails (`APP_URL`) and Supabase's allowed sign-in addresses move to `https://app.mitra.market` once it answers over HTTPS, so emails link to the new address; `mitra-gamma-ten.vercel.app` and `mitra-site-ten.vercel.app` keep working and stay on Supabase's list, so old links and current sessions are not broken.

## 2026-10-21 - The website shows only milestones that are hard to fake

**User instruction** (the owner): "Need to optimize website for mobile. also remove any of the lines that cna be aeaislt maniupalted, liek reviews or github stars or releases. put the example isntead ofg gtihub stars put fda clearance on our website. for the launch page" (spelling as written).

**Decision:** the website (`site/`, https://mitra.market) shows no example market whose answer the founder, or anyone with a little money, can easily move: no counts that can be padded (stars, reviews, ratings, sign-ups, downloads, user counts) and no events the founder alone controls (a release or launch date). Pulsewell's FDA 510(k) clearance market takes the place of Stackwise's GitHub stars, on the cards, the rules card and the FAQ's example. The other examples are milestones someone else decides: Lumenly's acceptance into Y Combinator and Nexa Robotics' 2027 Open Automation Prize (a fictional prize). All three come from the app's demo catalog and stay labelled Demo. The site is also reworked for phones.

**Assumptions (the owner can change any of them):** the "lines" are the site's example markets and "the launch page" is the website's one page; a monthly-user count counts as easy to pad, so Lumenly's 100,000 monthly users goes too; this covers the website only. The app's demo catalog still has such markets (among them Stackwise's GitHub stars, Northstar's Steam release and beta sign-ups and Orbit Kitchen's downloads); whether the app drops them is the owner's call.

**Follow-up answers, same day:** to "Push them to mitra.market now?" the owner chose "Push it live". To "The app (app.mitra.market) still has demo markets on GitHub stars, a Steam release date and download counts. Apply the same rule there too?" the owner chose "Yes, the app too", on the understanding that the markets the live app shows are checked first and the plan for hiding or replacing them is agreed with the owner before anything changes.

**The app's listing, agreed the same day.** Proposed: hide nine of the 20 listed demo markets (Draftboard 50K users, Lumenly 100K users, Orbit Kitchen downloads, Tracelight npm downloads, Stackwise #1 on Product Hunt, Tidepool top-10 games, Driftlight's Steam release, Loop Closet's second city, Ferro Labs' Kickstarter) and list seven hidden ones that someone else decides (Lumenly into Y Combinator, Nexa's Open Automation Prize, Draftboard acquired, Parallax AI into the Foundry accelerator, Verdant Grid's Gridshift Prize, Carbonfold's Material Futures Challenge, Kestrel's AgTech Demo Day). The owner's answer: "keep verfieid users. keep stack pwise 1 on product hunt. tidepool top ten games. remove steam release. loop clsoet second city rmeove. feero labs remove. everyhtig else show". To keeping the six counts an outside auditor or utility checks (Parallax 100 plants, Verdant 5,000 households, Tally $1M revenue, Sona 10,000 earbuds, Nexa 10,000 robots, Kestrel 1,000 farms): "Keep them". For industries left short of markets: "Draft new ones for me", one or two hard-to-fake demo markets each, approved by the owner before anything goes in.

**Decision:** hide only Driftlight's Steam release, Loop Closet's second city and Ferro Labs' Kickstarter; list the seven; everything else stays listed (24 listed). Hidden means `listed` false, not deleted: terms, statuses and activity are untouched, and the previous listing is kept in an owner audit entry so it can be restored.

**Reading taken (the owner can correct it):** "everything else show" covers the two download markets the answer didn't name (Orbit Kitchen's 100K Android downloads and Tracelight's 100K weekly npm downloads), so they stay listed. The app's rule is therefore narrower than the website's: founder-set dates and crowdfunding pledges go; verified user counts, rankings, downloads and audited counts stay.

