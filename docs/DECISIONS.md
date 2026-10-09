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
