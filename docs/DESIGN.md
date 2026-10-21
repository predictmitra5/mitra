# Market UI design

## Current product overlays (2026-10-12)

- Signed-out visitors may choose OSU or UIUC from the home-page selector to browse that campus. This is presentation-only; signed-in campus identity always comes from the verified account, and signed-out visitors cannot trade.
- Account and market surfaces label the trading balance **Gold Trade Coins**; new accounts start at zero. Silver Coins are displayed separately and are not trade collateral.
- `/shop` previews badge + Silver + Gold bonus + total price and uses disclosure. The purchase control is disabled until a payment provider is connected; there is no active checkout or currency issuance.
- Owners configure QR campaigns at `/review/campaigns`. A claimant explicitly requests device location and the server checks the campaign radius. Claimant coordinates are discarded and not logged or persisted.
- FAQ and Privacy remain generic Mitra pages. Currency labels and QR mechanics do not imply regulatory approval or legal compliance.

How Mitra's market surfaces are laid out, and why. Redesigned 2026-09-22 from three references the owner supplied: Kalshi's home page, GoFundMe's fundraiser grid and YouTube's home feed.

The owner's brief: Kalshi's price and information layout and its rundown of events; the thumbnail quality and title structure of YouTube and GoFundMe, compressed to a Kalshi-sized card; a price graph if it earns its place.

Applied first to the public home feed (`/`) and the goal page (`/markets/[id]`), then on 2026-09-23 to every page; see section 7.

---

## 1. What each reference does

### Kalshi — the market is the headline

- **The probability is the number that matters.** 47%, 54%, in outlined pills that double as the way to trade. Everything else is supporting detail.
- **Volume as social proof.** "$4,130,203 vol" under every market; "$773M volume" on hub cards.
- **Movement.** "▲ 2" beside a price in the Trending list: not just where a market is, but which way it is going.
- **A featured market with its chart**, in a carousel ("1 of 7"). The chart lives only here and on market pages, never on the small cards.
- **A rundown down the side.** Trending and category lists: question, outcome, percentage, change. Dense and scannable.
- **An upcoming strip** with dates first ("SEP 24").
- **Trust cards.** Market integrity, markets over monopolies, responsible trading. Short reassurance for a first-time visitor.
- Dark, with one saturated brand colour.

### GoFundMe — the person is the headline

- **A photo of the person**, large, at the top of every card.
- **The title names them and the stakes.** "Support Matthew Donovan's Recovery", "Help Yuen Through Harassment and Doxxing". Human, not abstract.
- **"by [organiser]"** directly under the title.
- **One bar you read at a glance**, then one number: "$89,368 raised".
- Light, generous whitespace, four columns.

### YouTube — the thumbnail is the headline

- **16:9 thumbnails that carry text.** "BOTH SOLD?", "$1000 challenge": a few huge words that say what is at stake before you read the title.
- **A corner badge** for duration, bottom right.
- **Avatar beside a two-line title**, then a meta line: channel, views, age ("197K · 6d ago").
- **Topic chips** across the top, the active one inverted.
- Dark, three wide columns.

---

## 2. What Mitra took, and the card that resulted

Each reference is strongest at one layer, so the card stacks them top to bottom.

| Layer | From | In Mitra |
| --- | --- | --- |
| Thumbnail | YouTube | 16:9, the stake in a few large words ("3.8 GPA", "GOOGLE INTERNSHIP"), category chip top left, time left bottom right |
| Identity | YouTube + GoFundMe | Avatar, a two-line title naming the person, then name · volume · age |
| Market | Kalshi | The chance of YES as the big number, the day's change beside it |
| Glance | GoFundMe | One bar, read as a probability instead of money raised |
| Action | Kalshi | YES and NO pills, which open the goal to trade |

**The key mapping:** GoFundMe's progress bar and Kalshi's probability are the same shape of information — one quantity between two ends. So the bar that says "how close to the goal" on GoFundMe says "how likely" on Mitra.

**Titles are compressed** by dropping the trailing deadline from template goals ("…offer from Google by March 1, 2027?" becomes "…offer from Google?"), because the badge already shows the time left. A goal written in the person's own words is never trimmed: "accepted by Stanford" must keep "by Stanford".

**The thumbnail's big text** is derived from the fixed template wording per goal type, with a fallback for anything else. When the display name is known it is stripped exactly, because shape alone cannot tell "Sam Lee launch" from "Sam launch".

### The page

- **Top bar** (Kalshi): brand, sign in and sign up.
- **Person chips** (YouTube's topic row). Tabs by person was decided on 2026-09-19; categories stay on the cards.
- **Featured carousel** (Kalshi): a goal, its YES and NO prices, volume, time left, the day's change, and its price chart.
- **Trust notes** (Kalshi): points only; proof checked by a person; nobody bets on their own goal.
- **Just added** (Kalshi's upcoming strip): decided on 2026-09-19, now with thumbnails and closing dates.
- **The grid** in ranked order.
- **Rundown** down the side (Kalshi's Trending): closing soon, and moving today.

---

## 3. The chart

**It earns its place on the featured goal and the goal page, not on grid cards.** The price path is the story of a prediction market: when opinion turned. But a sparkline on every card adds noise without adding a decision, and Kalshi itself keeps charts off its cards. The day's change carries direction on the card instead.

Built to the data-visualisation rules rather than by eye:

- **One series**, so no legend box; the heading names what is plotted.
- **A step line.** A price holds flat between trades, so a sloped line would draw movement that never happened.
- 2px line, 10% wash beneath, hairline solid gridlines, an 8px end dot with a 2px surface ring.
- **A crosshair that snaps to the nearest point**, with the value leading the tooltip and the time after it.
- **Keyboard reachable** (arrows, Home, End, Escape) with the same readout, a summary for screen readers, and a table view, so no value is reachable only by hovering.
- **Always fits its container.** It measures itself on mount, re-measures on resize, and has a `viewBox`, so even unmeasured it scales rather than overflowing. A ResizeObserver alone was not enough: it never fires while a page is hidden, and the chart stayed at its starting width and ran off a phone screen.
- The carousel leads with goals that have been traded, still in rank order. A featured chart with no history is a flat line. This changes only what the carousel draws; the ranking is untouched.

---

## 4. Colour

Dark, following Kalshi and YouTube, and because it is the genre convention for trading. Mitra's lime accent was already close to Kalshi's green-on-dark.

**Data colours were validated, not chosen.** Run through the palette checks (lightness band, chroma, colourblind separation, normal-vision separation, contrast) against the `#14171c` card surface:

| Role | Colour | Result |
| --- | --- | --- |
| YES | `#82a000` | Pass on all five |
| NO | `#796ae5` | Pass on all five; colourblind separation from YES delta E 31.5 |

The brand lime (`#d2f24a`) **failed** the lightness band as a data colour — too bright to sit beside another series at equal weight — so it is kept for buttons, the logo and labels, and data marks use the validated step. The day's change uses lighter, text-safe steps of the same two hues, so up reads as "towards YES" rather than "good", and the arrow carries direction on its own.

---

## 5. What was deliberately not taken

Each of these is a product decision that has not been made, so the redesign leaves a place for it rather than inventing it.

- **Photographs.** GoFundMe and YouTube lead with faces. On Mitra these would be photos of real students, which is the profile picture question the owner deferred. Thumbnails are generated per goal type instead, with the person's initials as a large faded monogram; the component takes a photo once that is decided.
- **Search.** Kalshi and GoFundMe put search front and centre. The feed decision of 2026-09-19 excludes it.
- **Category tabs.** Kalshi's topic row. The owner chose tabs by person.
- **Trader counts.** YouTube shows views and Kalshi implies participation. In a small friend group "1 trader" can identify someone, so counts stay private. **Play-point volume is shown**, as the Kalshi information the owner asked for; it is an aggregate, and it is a new public disclosure, recorded as such.

---

## 6. Trying it

```bash
node --env-file=.env.local scripts/preview-feed.mjs
```

After `npm run build`. Seeds seven fictional people and fourteen goals with price paths and trades into a disposable schema, serves the app at http://localhost:3100 signed out, and removes it all on Ctrl+C. `--dev` runs a hot-reloading server instead; stop `npm run dev` first, as the two share a build folder. If the process is killed rather than stopped, `--cleanup` removes what it left.

For the signed-in pages, `node scripts/preview-signed-in.mjs` renders the real page components against an in-memory database of fictional people at http://127.0.0.1:3120. No credentials, no Supabase, no Auth users; forms render but do not submit.

---

## 7. Every page (2026-09-23)

The owner said to go ahead after being asked whether to roll the look out everywhere. Sign-in, sign-up, password pages, account, new goal, your predictions and the three owner pages now share the market top bar and footer, and the dark tokens moved from a scoped class to `:root`.

- **Components that assumed a light page were rewritten, not overridden.** Several used the ink colour as a background with white text on top; flipping the tokens alone would have produced near-white blocks with near-white text. Inputs no longer hard-code white. Primary buttons are lime with dark text. The welcome panels (balance, your predictions, the sign-up story) use a faint lime wash instead of a solid dark block, which on a dark page would vanish.
- **Your predictions uses the feed's card parts**: the thumbnail, avatar and chance bar, so a goal looks the same everywhere. YES and NO holdings carry the same short colour keys as the price pills.
- **The arrow glyph.** The app's `↗` rendered as a blue emoji tile on Windows, including inside the logo. `font-variant-emoji: text` did not prevent it; the text-presentation selector (U+FE0E) after each arrow does, and a test keeps every arrow marked.

---

## 8. Photos, the ticker, live prices and the motto (2026-09-24)

- **The motto**, "Bet on literally anything.", leads the feed in a compact band with one button, and the sign-up story. "Anything" is the goal form's default, with tappable ideas in one scrolling row.
- **Photos.** The avatar shows the person's photo; thumbnails put it in a ringed circle where the faded initials were, so a card now reads like a GoFundMe card: a face and a stake. Goals in the person's own words get one of five art variants picked from the goal id instead of one grey. Anyone without a photo, or banned, falls back to initials rather than a broken image.
- **The ticker tape** runs across the top of the feed: avatar, a stock-style symbol ("MAYA·3.8GPA"), price and the day's change. It pauses under the pointer or keyboard focus and stands still, scrollable, for anyone who asks their system for less motion. The copy that makes the loop seamless is hidden from screen readers and the keyboard.
- **The chart** now reads like a stock chart: the current price large, the change over the chosen range, and 1D, 1W, 1M and All. The line takes the validated YES colour when the range ended up and the validated NO colour when it ended down; both colours passed the palette checks earlier, so no new colour was introduced.
- **Live prices** every 15 seconds while visible. A price that moves pulses once, lime up or violet down, behind the number; the arrow and the number carry the direction, and the pulse is off for reduced motion. Ranking order does not change live, so cards never jump under a finger.
- **Owner:** a "Review" button with a count in the top bar, visible on a phone too; the People page lists everyone with their photo, standing and live goals.

---

## 9. The Kalshi direction (2026-09-24)

The owner said the app "needs to look more like kalshi, not tiktok", picked a direction on the Mitra UI canvas ("Kalshi direction" page, boards `K*.dc.html`) and asked for it to be built. The decisions and the owner's words are in DECISIONS.md, 2026-09-24. This section supersedes the card anatomy of section 2, the colours of section 4, the tabs and search points of section 5, and the ticker, flash colours and motto band of section 8.

### Tokens

| Token | Value | Use |
| --- | --- | --- |
| Page | `#0e0f11` | Background |
| Surface | `#15171a` | Cards, panels, inputs' surround |
| Raised | `#1c1f23` | Selected range button |
| Divider | `#24272c` | Hairlines, card borders, chart gridlines (dashed 2/4) |
| Strong divider | `#30343a` | Inputs and secondary buttons |
| Text | `#eceef1` | Primary |
| Soft text | `#c9ccd2` | Rules paragraph |
| Muted | `#9097a1` | Labels, meta, ticks |
| Yes / up | `#34c77b` on `#10251a` | Yes buttons, rises, the chart when it ended up |
| No / down | `#f2545b` on `#2a1517` | No buttons, falls, the chart when it ended down |
| Lime | `#d2f24a` with `#141a00` text | Main actions only: Post a goal, Buy |

Inter at 400/500/600/700 with tabular numbers everywhere, with Inter Tight for major headlines. Radii: 12px cards, 8px buttons and inputs, 6px photo squares. No gradients and no generated thumbnail art on the feed; restrained shadow is limited to the neutral entry card.

The owner chose green for Yes and red for No and waived the colour-blindness concern. Direction never rests on colour alone: every change carries ▲ or ▼, and every button says Yes or No in words.

### Feed

- **Header:** "mitra" wordmark and the motto, search, Goals and Positions, the viewer's points, a lime "Post a goal" and their photo; Log in and Sign up when signed out; the owner's Review count stays. On a phone: wordmark, points and photo; the search sits under the header.
- **Ticker:** one still row of first name and stake, chance and today's change. Scrolls sideways by hand; it no longer moves on its own.
- **Tabs:** Competitions / Awards (club and running outcomes), Academics (GPA), Anything (every goal), and a disabled Coming soon label. Search still exposes every goal under Anything.
- **Search:** filters the cards as you type, on the question, name and handle. The text lives in the address (`/?q=`), updated without reloading, so a search from any page lands on the filtered feed and typing records no extra exposures.
- **Featured goal:** the open goal that moved most in the last 24 hours, with its chart over that day, its volume and close date, and Yes and No. On a desktop, the Closing soon list sits beside it.
- **Cards:** photo square, category · name, the question, a large chance, today's change to one decimal and time left, and Yes and No buttons with prices that open the goal with that side chosen.

### Goal page

Breadcrumb, person, question; the chance large in Yes green with the change over the chosen range; the step chart with dashed gridlines and 1D, 1W, 1M and All; volume, close date and the No price; the rules with the four dates; proof as a dated list, newest first, of the owner's verified statements and the opening. The trade panel sits on the right on a desktop and in a bottom sheet on a phone, opened from a Buy Yes / Buy No bar. It estimates shares and "To win" with the market maker's formula at the current price, and the lime button leads to the existing exact preview and confirmation.

### Account

Name and handle, available points large, points in positions with the gain or loss, positions valued at today's price with the change since bought, your goals with their status wording, owner tools for the owner, the photo and sign out. There is no top-up or refill control. `/positions` is the same list with every holding, 20 to a page, and the header's Positions link goes there.

### How it is built, and what the build taught

- **The chart places everything by percentage.** The step line is an SVG stretched to the plot with a stroke that does not stretch; gridlines, labels, the end dot and the crosshair are ordinary elements. It is therefore right at any width from the first paint, with nothing to measure, which replaces the three-layer measuring of section 3 and fixes the pre-measurement size the signed-in preview used to show.
- **One trade panel, moved by the stylesheet.** On a desktop it is a sticky aside; below 900px it hides behind the Buy Yes / Buy No bar and opens as a bottom sheet that is a modal dialog (focus moves in and stays, Escape closes and returns focus, the page behind stays still). There is only ever one form on the page.
- **Search and tabs live in the address** (`?q=`, `?tab=`) and change it with `history.replaceState`, which Next.js reads without a request. Links to the feed have prefetching off: a prefetch could render the feed on the server, which records views.
- **Screen-reader text inside a sideways-scrolling row escapes it** unless the row is positioned: the ticker's hidden "Up 6.2 points today" labels widened the whole page to 2,041 pixels until `.ticker` got `position: relative`.
- Photos in the feed are squares; the viewer's own photo in the top bar and on the account page is a circle.
- The phone header keeps the wordmark, points and photo; the motto is in the footer there, as on the boards. The search is its own row under the bar on the feed only.
- Not built from the boards: the account page's "Trade history" link (not on the owner's list) and editing the display name (not a feature).

---

## 10. Campus editions (2026-10-04)

_Superseded on 2026-10-05 by section 12, except the campus registry and the no-official-marks rule._

Mitra is the parent product with **Mitra at OSU** and **Mitra at UIUC** launch editions. This section supersedes section 9 only where it describes the lime brand accent and plain `mitra` wordmark. The data-first layout, Inter, dark surfaces and semantic market colours stay.

### Campus layer

- `src/config/campus.ts` holds both editions' names, university names, email domains, onboarding hints and independence statements. The server derives the account campus from the confirmed email; a cookie remembers only the display edition.
- The header lockup is the lowercase Mitra wordmark plus a small outlined `at OSU` or `at UIUC` capsule. It is an original text treatment with no university logo, mascot, official typeface or artwork.
- Every footer links to `/faq` and `/privacy` and says that Mitra is an independent platform, not affiliated with, endorsed by or sponsored by any university.
- FAQ and Privacy always use neutral graphite design tokens and the neutral Mitra header/footer, regardless of the selected campus or campus cookie. The FAQ explains the current 1,000-point grant once, alongside eligibility, self-posted goals, trading restrictions, approval and resolution. The privacy page states what signed-in community members can see, what remains private, how automated evidence reading works, the infrastructure providers, anonymous feed measurement and the self-service deletion policy.

### Neutral entry refinement (2026-10-05)

The signed-out entry stays subdued blue-gray and says only Mitra. Its two university choices now use actual identity accents—OSU scarlet `#ba0c2f` and UIUC orange `#ff5f05`—in the selector swatches, selected-state border and hover treatment. The rest of the entry remains neutral, so selecting a community does not turn the public page into a university-branded landing page. Copy is shorter and utility-first: choose a university, verify the inbox, start with 1,000 points, then enter the private community.

### Tokens

| Token | Value | Use |
| --- | --- | --- |
| Page | `#0c0d0f` | Near-black canvas |
| Surface | `#141518` | Cards and panels |
| Raised | `#1c1e22` | Selected and elevated controls |
| Divider | `#282a2f` | Hairlines and card borders |
| Text | `#f3f3f4` | Primary text |
| Muted | `#989ba2` | Supporting labels |
| Scarlet | `#ba0c2f` with white text | Primary actions, top rule and owner badge |
| Scarlet hover | `#d0193d` | Interactive emphasis on the dark canvas |
| Scarlet wash | `#2a1016` | Notes, highlights and the campus capsule |
| Illinois orange | `#ff5f05` with white text | UIUC edition actions and identity |
| Illinois orange hover | `#ff762b` | UIUC interactive emphasis |
| Yes / up | `#34c77b` | Market semantics only |
| No / down | `#f2545b` | Market semantics only |

Ohio State publicly describes scarlet, gray and white as its primary palette and cautions that a moderate amount of scarlet goes a long way. UIUC uses Illinois Orange as the second edition's accent. The interface uses campus color sparingly rather than flooding the page, and it keeps Yes/No colors semantic. Independence copy and avoidance of official marks reduce confusion but do not replace any permission the operator may need. References: [Ohio State EHE graphics guidance](https://brand.ehe.osu.edu/graphics/) and [student trademark requests](https://trademarklicensing.osu.edu/page/student-request).

---

## 11. Neutral signup-first entry (2026-10-05)

_Superseded later on 2026-10-05 by section 12: visitors browse first and sign up in Kalshi-style steps._

- Signed-out `/` is the signup surface. It contains the parent `mitra` wordmark, university selection and concise trust/product context, but no live goals, example events, prices, positions, ticker or feed.
- The entry palette is deliberately campus-neutral: deep blue-black canvas, blue-gray surfaces and a muted steel-blue action color (`#6f96c2`, hover `#83a8d1`). University cards remain text-first and do not repaint the page.
- Selecting OSU or UIUC changes validation copy and the accepted email domain only. Even the credential and verification steps remain neutral; the `Mitra at OSU`/`Mitra at UIUC` lockup and scarlet/orange theme start after a verified session.
- The layout is a single column on phones and a balanced signup/product-context split on desktop. FAQ and privacy stay public, with a generic independence statement on the entry shell.
- Feed and market layouts from sections 9 and 10 are unchanged for authenticated members. Signed-out direct market requests redirect to signup before any market query, click/exposure event or profile-photo read.

## 12. Browse first, Kalshi-style sign-up and onboarding, the logo, Helvetica (2026-10-05)

Decided by the owner after reviewing a canvas of the screens (https://claude.ai/artifact/CRVbTCMDaHEyE6w3sm6xkP); DECISIONS.md, 2026-10-05. Sections 9's layout (ticker, framed cards, featured goal, Closing soon, goal page and trade panel) stays; this section replaces its colours and type, and sections 10 and 11.

### Look

- **Themes.** Black by default, white when the person picks it with the moon/sun button in the top bar. The choice is a cookie (`mitra_theme`), so the server sets `html[data-theme]` and the first paint is right; both icons and labels are in the button and CSS shows the pair for the theme.
- **Type.** Replaced on 2026-10-09 by Geist (section 14). Until then: Helvetica throughout (`--font-sans`: Helvetica Neue, then TeX Gyre Heros, then Arial). Apple devices use their own Helvetica Neue and download nothing; Windows and Android download TeX Gyre Heros (regular and bold, about 135 KB each), a freely licensed Helvetica match self-hosted from `public/fonts/tex-gyre-heros` (GUST e-foundry, LPPL 1.3c, unmodified, licence alongside). Plain "Helvetica" is not in the list because Windows maps that name to Arial, which would stop the browser before the look-alike. Two weights only, 400 and 700 (2026-10-06), because the look-alike has no others. Tabular numbers everywhere.
- **Colour.** Baby blue `#89cff0` for main actions with dark ink `#04212f`; green Yes and red No, brighter on black (`#3fd38a`, `#ff5c63`) and darker on white (`#0e8546`, `#c8323a`) so text on their tints passes contrast. Black: page `#0b0c0e`, cards `#141619`, borders `#262a30`/`#3a3f47`. White: page `#f5f6f8` so white cards stand out, borders `#e2e5e9`/`#c9ced5`.
- **Controls.** Pill buttons. The selected tab or chart range is a solid pill in the text colour. Yes/No buttons are tinted at rest and fill solid on hover.
- **Hover and press.** About 160 ms: main buttons brighten with a soft baby blue ring, outline buttons and tabs fill lightly, goal cards lift 2 px with a shadow, list rows highlight, everything presses to 97%. Hover rules apply only where there is a mouse; reduced motion keeps the colour changes and drops the movement.
- **Logo.** The owner's lockup (symbol and MITRA), traced from their image into one SVG path (`src/app/components/brand/logo.tsx`) drawn in `currentColor`: baby blue on black, a deeper `#3aa3d9` on white. The symbol alone is the tab and app icon (`src/app/icon.svg`, `apple-icon.png`).
- **School.** Once signed in, the school's name sits after a thin divider beside the logo in its colour: scarlet for Ohio State, orange for Illinois, each lightened on black and darkened on white to stay readable. No other campus colouring, no official marks.

### Browsing and the pop-up

Visitors see the same feed and goal pages as members. After 30 seconds a native `<dialog>` opens (centred on a laptop, a bottom sheet on a phone): "Create your account", one button per school, Log in, and a concise 1,000-point line. Closing it stops it opening by itself again for the browser session; any Yes, No or trade control opens it at once instead of acting (`src/app/components/signup-prompt.tsx`).

### Sign-up, sign-in and onboarding

One screen per step (`src/app/components/step-frame.tsx`): a four-part progress bar (account, profile, photo, getting started), back arrow, logo in the middle, close, one 560 px column with large headings and 56 px pill buttons.

- **Sign-up** (`signup-flow.tsx`): school (skipped when the pop-up already chose it), school email, the six-digit code (resend after 60 seconds, change email), password.
- **Onboarding** (`/welcome`): name and @username, 18 or older (these two create the profile), photo with a circular picker and "Skip for now", topics as pills, how Mitra works, then the feed.
- **Sign-in, forgot and reset password** use the same frame without the progress bar.

### Chart

Yes and No are two step lines, green and red, with a dot at each end, dotted gridlines labelled on the right, dates below, and a legend with both values that follows the crosshair (`price-chart.tsx`). The headline chance and the 1D/1W/1M/All pills stay. Not built from the reference: the floating "+ 10" trade amounts, which would need a new public feed of individual trade sizes.

## 13. Campus event markets (2026-10-08)

The owner's pivot brief and image (DECISIONS.md, 2026-10-08). The look of section 12 stays: tokens, Helvetica at 400 and 700 (Geist since section 14), pills, the chart, the trade panel. What changed is what a market is about, so every place that showed a person now shows a venue.

- **Motto:** the top bar and the footer say "Trade on what happens here." The opening card built from the owner's image ("mitra.", the motto, the campus and "Your campus. Your market." as pills) was removed the same day at the owner's request; the feed opens with the ticker and tabs as before.
- **Tabs and filters:** All, Nightlife, Food, Events, Entertainment, Campus and the disabled Coming soon label, then three pill selects beside the grid's heading: venue, status (Open by default; Closed, Resolved, Void, Any status) and closing date (within a day, this week, this month). All of them live in the address (`?cat=`, `?venue=`, `?status=`, `?closes=`, `?q=`) and change it without a request, like the tabs before them. An empty result says so and offers Suggest a market.
- **Cards:** the venue's initials in the photo square, category · venue (a link to the venue page) and a Sample tag where it applies, the question, the chance, today's change and points traded, then the closing time and time left; a market no longer open shows where it stands (Trading closed · awaiting result, Resolved: Yes, Void · refunded) instead of the Yes and No buttons.
- **Market page:** venue and event above the question; a Sample note under it for samples; the chart and trade panel as before; Rules opens with two tinted boxes, Resolves Yes if (green) and Resolves No if (red), then the full rules and the facts (event window, trading cutoff, results due, opened at, if no result arrives: void/refund, if voided: refunded); then Verification source with a Connected or "Placeholder · not connected" badge, how it counts and its link. The proof list is gone.
- **Venue page** (`/venues/<slug>`): the venue's mark, name, category and area, one line about it, then its open markets and its closed, resolved and void ones.
- **Sample label:** a small outlined tag in the accent wash wherever a sample appears (cards, the featured market, Closing soon, positions, the venue page), and a fuller note on its own page saying it is hypothetical, that Mitra has no partnership with the venue and that its early price history is demonstration data.
- **Suggest a market** and the owner's publish form reuse the existing form fields, with selects styled as fields and two-up rows that stack on a phone.
- **Positions:** each holding shows category · venue above its question; `/positions` adds a Trade history list.
- The owner's phone top bar drops the points figure when the Review link is present, so it fits at 375 pixels (it overflowed before this change).

## 14. XO Market and Kalshi type, smooth loading, short titles (2026-10-09)

The owner, with screenshots of the live feed beside XO Market's and Kalshi's: the fonts looked thin and oddly placed, the sites felt less smooth, and each market had too many words (DECISIONS.md, 2026-10-09). Drawn on a canvas first (https://claude.ai/artifact/RhETGs9cAoH5mMZDk4eNXm: the feed on a desktop and a phone, the market page after a click), then built. Tokens, colours, the logo, the chart and the trade panel of sections 12 and 13 stay.

### Type

- **Geist** for everything, loaded by `next/font/google` in `src/app/layout.tsx`: downloaded at build time and served from the site itself (no visitor's browser asks Google), with a fallback sized to match so text never jumps when the font arrives. `--font-sans` in `globals.css` names it. TeX Gyre Heros and `public/fonts` are gone.
- **Three weights.** 400 for reading, 500 for labels, tabs and navigation, 600 for titles, numbers, buttons and bold text (`b, strong` are 600, never the browser's 700).
- **Hierarchy, as in the references:** category · venue above a title in small capitals with wide spacing (11.5 px, 600, 0.07em); card titles 16.5 px; the featured title 30 px; the featured chance 52 px and a market page's 56 px; the market page's question 34 px over at most 30 characters a line; large type is tightened (−0.025 to −0.04em).

### Layout

- **Top bar** 64 px; Log in is a filled dark pill like XO Market's, Sign up stays baby blue.
- **Tabs** are plain text (500) with a 2 px underline under the one picked, as on both references, instead of solid pills. When another is picked, the underline slides there (`CategoryTabs` in `src/app/(feed)/feed-view.tsx`, Web Animations, 280 ms).
- **Featured market** in two columns, as XO Market's hero: on the left the venue mark, category · venue, Moving most today and Sample tags, the short title, the event, the chance, Yes and No, and points traded with the closing time; on the right the Yes/No chart. One column on a phone.
- **Closing soon** beside it at 380 px, rows in 500.
- **Cards:** the venue mark, category · venue and the Sample tag on one line, then the short title beside the chance, today's change and points traded, Yes and No, and the closing time with time left. The whole card opens the market (the title's link is stretched over it); the venue link and the Yes/No buttons stay separate links on top. Radius 16 px.

### Short titles

A market can carry a short title (`markets.short_question`), e.g. "Will Midway on High sell more than 1,000 drinks?". Cards, the featured market, Closing soon, the ticker's hover text, the trade panel's heading, positions and trade history show it (`cardTitle` in `src/modules/discovery/present.ts`); the market page shows the full question as its heading, and a card's hover text shows the full question. The owner's publish form has a Short title field (10 to 70 characters, optional). Search matches both.

### Motion

- **Loading screens** (`src/app/(feed)/loading.tsx`, `src/app/markets/[id]/loading.tsx`, pieces in `src/app/components/loading-shell.tsx`): the real logo and soft shimmering blocks in the page's shape, faded in after 120 ms so a quick load never flashes them. Card and Closing soon links prefetch only up to the market page's loading screen, which runs none of the page and records no click (checked: 15 prefetches, no clicks recorded; one tap, one click), so a tapped card answers at once. The feed sits in the `(feed)` route group so its loading screen never shows for other pages.
- **Entrances:** the featured market, Closing soon, cards (45 ms apart, at most 8 steps), and the market page's sections and trade panel rise 8 px and fade in over 420 ms. Fill mode is `backwards`, so hover lifts still work afterwards.
- **Chart:** both lines draw in from the left over 900 ms (a clip reveal), then the dots at today's price appear.
- **Reduced motion:** none of the above moves for people who ask their device to reduce motion; colour changes stay.

## 15. Coins, one badge family, owner QR images, and a quieter navigation (2026-10-12)

The owner clarified the customer-facing vocabulary and hierarchy after reviewing the shop and campaign tools (DECISIONS.md, 2026-10-12).

- **Currency labels:** the cosmetic balance is “Coins”; the balance used for markets is “Trade Coins.” Never use “Silver” or “Gold” in visible copy, labels, accessibility text, or page metadata. Internal database and code identifiers may retain those legacy terms until a separately planned schema rename.
- **Shop hierarchy:** one Mitra badge is offered at multiple levels. The selectable Coin amount, matching Trade Coin bonus, and disclosed price are prominent; the badge identity and level are supporting detail. Show what each balance is for and keep the bonus disclosure before payment. Payment controls remain disabled until an actual provider and verified fulfillment exist.
- **Campaign QR:** after creating a campaign, the owner sees its private claim URL as a locally rendered QR image and can download the SVG. The URL is a campaign claim link, limited to one claim per account and the configured campaign cap—not a globally single-use token. Do not send the URL to an external QR generator. GPS is a signal only; do not present it as spoof-proof proof of presence.
- **Navigation:** keep the global bar focused on Markets, Positions, Shop and the account; owner management remains available through the owner tools inside the account. Preserve search, campus selection for signed-out visitors, theme toggle and existing core destinations.
- **Signed-out campus selection (2026-10-13):** place the selector in the brand lockup immediately after the Mitra logo, where the verified-campus label appears after sign-in. The current campus name opens a compact dropdown with Ohio State and Illinois links; changing schools switches the public feed immediately, preserves its search, and updates its campus-specific footer disclosure. This does not change signed-in campus identity or enable trading.

## 16. Founder videos and startup market cards (2026-10-19)

The owner: keep "the exact same vibe and animations as the current mitra", change only the market cards, as close as possible to two screenshots, with the chart, the video thumbnail and the market's question all present; and replace every logo with the new `Mitra.svg` (DECISIONS.md, 2026-10-19). Tokens, Geist at 400/500/600, the tabs with their sliding underline, loading screens, entrances, the chart draw-in and reduced motion from sections 12 to 14 are unchanged.

### Logo

The owner's wordmark and lotus, cut from `Mitra.svg` into `public/brand/mitra-logo.svg` and `mitra-lotus.svg`, drawn in the text colour through a CSS mask (`.logo-mark` in `globals.css`, `src/app/components/brand/logo.tsx`), so it follows the theme. `src/app/icon.svg` and `apple-icon.png` are the lotus.

### Thumbnail

`src/app/components/startup/thumb.tsx`, after the first screenshot: on a slate panel, the founder on the left (photo, or initials in a pastel circle, with name and role) and on the right the startup's glyph, name, tagline and three product features in a darker panel; "Founder video" and the length run along the bottom. It is HTML scaled with container units (`cqw`), so it is sharp at any size and needs no image; the palette is fixed slate in both themes, like a picture, and only the founder circle's pastel varies. A real thumbnail (`videos.thumbnail_url` or `startups.thumbnail_url`), like the second screenshot, replaces the drawing everywhere. Demo thumbnails carry a small Demo tag.

### Market card

`src/app/components/market/market-card.tsx`: the thumbnail on top (16:9, the whole card opens the market), then industry · startup in small capitals with the Demo tag, the question (short title when there is one), the chance in large numbers beside a compact price-history line with its range, and Yes and No buttons with their prices. Resolved markets show the outcome instead of a price and no daily change. Radius, hover lift and entrance are the old card's.

### Feed

`/` is a vertical video feed (`src/app/components/feed/reel.tsx`, `video-card.tsx`): For you and Following as text tabs, one video per screen with proximity scroll-snap, arrow keys and swipe; only the video in view plays (IntersectionObserver), muted until the viewer turns sound on, with captions. Beside the video on a desktop, and below it on a phone: the founder line with Follow, the title, description and tags, then the featured market as a card (chance, chart, Yes and No) linking to its page. A rail carries like, comment, share, save and more (follow the startup, not interested, report). Demo videos have no file; their player draws the thumbnail with the founder's captions over a working progress bar.

### Market page

`/markets/[id]` in the brief's order: thumbnail and video; question and chance; a large chart with 1D, 1W, 1M, 3M, 1Y and ALL, hover tooltips and volume bars; description; statistics (Yes and No prices, volume, traders, close, created, status); the trade panel (Yes or No, Trade Coins or an exact number of contracts, balance, cost, payout if right, profit or loss, then a confirmation); resolution criteria with the source and verification level; discussion. On a phone the trade panel is the bottom sheet of section 12.

### Other pages

Startup and founder profiles (thumbnail, about, team, videos, markets, updates, verified facts, follow), `/search`, `/activity`, `/portfolio`, `/following`, `/create` for founders and the owner's `/review` reuse the same tokens, cards, tabs and loading screens.

### Rebuilt on the 2026-10-12 line (2026-10-19)

Section 15's shop and QR campaign screens stay as built; its quieter navigation and the campus pickers give way to the bar above (For you, Following, Markets, Activity), because startup markets have no campus. The balance in the bar reads Trade Coins; the account page shows Trade Coins and Coins and links the shop; owners reach QR campaigns from the account page's owner tools. The new section-15 styles use weight 600 where they had 700, so Geist stays at 400, 500 and 600.

## 17. YouTube's home (2026-10-20)

The owner: "we aren't trying to become tiktok here. we are trying to become youtube", with YouTube's home on a desktop and a phone to copy (DECISIONS.md, 2026-10-20). Colours, Geist at 400/500/600, the thumbnails, the chart and the motion of sections 12 to 16 stay; the layout is YouTube's. The swipe feed of section 16 is gone.

### Top bar

`MarketHeader` (every page): the guide button and the logo; a centred search pill with YouTube's search button at its end; then the theme switch, Trade Coins, a raised Create pill, the bell (Activity) and the avatar (Portfolio); Log in and Sign up for visitors; Review with its count for the owner. 56 px tall, on the page colour.

### Guide

YouTube's left column (`Guide` in `market-header.tsx`): Home and Markets; Following, listing the founders you follow (or a Log in note); You (Portfolio, Activity, Saved videos, Your founder page, Shop, Account); Explore (the industries, each opening the home on that topic); Owner (Review, Create a market, Outcomes, QR campaigns, People, Audit record); the small print. On the home and Following pages it stays beside the page from 1312 px wide, narrows to YouTube's icon column (Home, Markets, Following, You) from 800 px, and the guide button toggles full and icons (remembered on the device). On other pages, and between 800 and 1312 px, the guide button opens it as a drawer over a dimmed page, closed by the scrim, Escape or a link (`guide-controls.tsx`).

### Home

`src/app/(feed)/page.tsx` and `src/app/components/home`: chips (All, Following, New, Closing soon, the industries; a compass to Markets on a phone) that filter in place and live in `?topic=`; a grid of three columns (four from 1900 px, two from 800 to 1099 px, one on a phone); one Closing soon shelf after the first six cards, scrolling sideways, with Explore more; more cards as the page scrolls.

### Card

`GridCard`: the 16:9 thumbnail with the video's length in its corner and the Demo tag; the founder's avatar beside the market's question (two lines at most); the startup and founder as the channel; the chance in baby blue with today's change and the price line; "308 traded · 15 months left" where YouTube puts views and age; a ⋮ menu (Save, Follow the startup, Not interested, Copy link, Report) that shows on hover on a desktop. One card per market. The first card is the market moving most today (YouTube's sponsored slot): "Moving most today" in its stats and Yes and No pills under it; on a phone its video plays muted with captions and its description shows, as YouTube's first video does.

### Phone

Below 800 px: the logo, the theme switch, search and the bell on top; full-width videos with square corners; the bar along the bottom: Home, Markets, Create (a round +), Following and You (the avatar).

## 18. Mitra's own website (2026-10-20)

The owner: "i want the vibe to be more of vela, but the animations and stuff for xo.market", with screenshots of velaenergy.ai's Company page and xo.market's home; a separate website, the lotus animated on the opening, a founders section, and currency-neutral words (DECISIONS.md, 2026-10-20). Both sites were read in a browser on 2026-10-20, code included, for their motion and timings. It lives in `site/` (TECH_STACK.md) and is one page.

### Look (Vela)

- Black (`#0b0b0c`), white and a light grey (`#f2f2f3`); colour only in market pictures (green Yes, red No) and the focus ring (the app's baby blue). Geist at 400, 500 and 600, as in the app; headlines are 600 and set tight (−0.05 to −0.056em), up to 152 px for the statement.
- A floating rounded menu bar 62 px tall, 14 px from the top: dark glass over black sections, white over light ones, switching as each section passes under it, with the section in view marked (`site-header.tsx`). The Open Mitra pill is white on dark and black on light. Below 1000 px the links fold into a menu panel.
- Thin vertical rules down the content edges of white sections, small-capital tags in solid chips, pill buttons with an arrow that nudges on hover, a black footer with a huge faint wordmark.

### Motion (XO Market, `motion-root.tsx`)

- Smooth scrolling (Lenis, lerp 0.1) driven by GSAP's ticker.
- Every section after the opening is a sheet with 32 px rounded top corners (24 px on phones) overlapping the one before by that much; as it slides up, the covered section's content sinks by 18% of the window and a 24% black scrim fades in over it (XO's numbers).
- Headlines rise line by line from behind a mask (SplitText; 1.15 s, expo out, 80 ms apart) and then return to plain text so no letter is ever clipped. Copy and pictures rise 34 px and fade in; the example cards come in from a 6 px blur, 90 ms apart.
- The opening: the lotus, the owner's logo drawn as hairline outlines of its strokes (`lotus-art.tsx`, from `public/brand/mitra-lotus.svg`), draws itself in over 3.4 s, a faint fill settles under it, it breathes on an 8 s cycle and a light runs along its lines every 8 s; behind it a canvas of faint lines wanders and drifts left like price histories, one brightening now and then with a dot where it is "now" (`hero-field.tsx`; decoration with no data). The art drifts down and fades as the page scrolls away. A round pause button, as on Vela, stops all of it.
- How it works: four steps beside a card that plays them through by itself (a founder's video with captions, the market's rules, a cursor picking Yes, how it settles), with dashes counting the steps; the steps list marks the one in play and jumps to any step picked; it plays only on screen and has its own pause (`how-story.tsx`).
- The rules card's lines arrive one by one, its track fills to Open and the locked-wording note pops in, once (`rules-card.tsx`). The closing lotus draws itself in with the scroll.
- On screens at least 768 px wide whose footer fits, the footer waits pinned under the page and the last sheet lifts off it (`footer-shell.tsx`); its wordmark's light passes three times once the end is in view.

### Sections and words

The opening ("Watch founders build. Call what happens next.", Open Mitra and How it works); example markets ("What founders say they'll do next.", three demo cards from the app's catalog with the drawn founder thumbnail, industry and startup, the question, the close date and Yes/No, no prices, volumes or trader counts, and the note that they are fictional); the statement "A pitch is easy. A milestone is proof." in corner brackets, then how it works; how markets settle (a demo market's written rules, word for word from the catalog, and three facts: locked wording, named sources, labelled facts); for founders (post videos, markets on your milestones, hands off your own markets); the team (Vela's layout: heading, group photo, each founder, an optional backgrounds grid), built from `site/src/content/team.ts` and shown only on `next dev` with labelled empty places until the owner sends details; questions; "Get to know Mitra."; the footer. No currency is named anywhere (the owner's answer of 2026-10-20). Every link to the app uses `NEXT_PUBLIC_APP_URL`.

### Phone and reduced motion

At 375 px nothing scrolls sideways: the headline wraps freely, the lotus sits behind it, the cards scroll sideways in their own row, grids become one column and the footer is not pinned. For people who ask their device to reduce motion: no smooth scrolling, sheets, line reveals or drifting; the lotus is drawn and still, the walkthrough waits on its step, and the pause buttons are hidden. Without JavaScript the page shows everything; with it, anything that will animate in waits unseen until the motion starts, or three seconds at most.
