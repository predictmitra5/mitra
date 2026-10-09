# Market UI design

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
- **Type.** Helvetica throughout (`--font-sans`: Helvetica Neue, then TeX Gyre Heros, then Arial). Apple devices use their own Helvetica Neue and download nothing; Windows and Android download TeX Gyre Heros (regular and bold, about 135 KB each), a freely licensed Helvetica match self-hosted from `public/fonts/tex-gyre-heros` (GUST e-foundry, LPPL 1.3c, unmodified, licence alongside). Plain "Helvetica" is not in the list because Windows maps that name to Arial, which would stop the browser before the look-alike. Two weights only, 400 and 700 (2026-10-06), because the look-alike has no others. Tabular numbers everywhere.
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

The owner's pivot brief and image (DECISIONS.md, 2026-10-08). The look of section 12 stays: tokens, Helvetica at 400 and 700, pills, the chart, the trade panel. What changed is what a market is about, so every place that showed a person now shows a venue.

- **Opening card** on the feed (`src/app/components/campus-hero.tsx`), from the owner's image: "mitra." large in the logo's colour (baby blue on black, `#3aa3d9` on white), "Trade on what happens here.", the campus's name and "Your campus. Your market." as pills, on a faint wash of the accent. The pills stack on a phone, as in the image, and sit in a row on wider screens. It hides while a tab, filter or search narrows the feed. The top bar's motto and the footer say "Trade on what happens here." too.
- **Tabs and filters:** All, Nightlife, Food, Events, Entertainment, Campus and the disabled Coming soon label, then three pill selects beside the grid's heading: venue, status (Open by default; Closed, Resolved, Void, Any status) and closing date (within a day, this week, this month). All of them live in the address (`?cat=`, `?venue=`, `?status=`, `?closes=`, `?q=`) and change it without a request, like the tabs before them. An empty result says so and offers Suggest a market.
- **Cards:** the venue's initials in the photo square, category · venue (a link to the venue page) and a Sample tag where it applies, the question, the chance, today's change and points traded, then the closing time and time left; a market no longer open shows where it stands (Trading closed · awaiting result, Resolved: Yes, Void · refunded) instead of the Yes and No buttons.
- **Market page:** venue and event above the question; a Sample note under it for samples; the chart and trade panel as before; Rules opens with two tinted boxes, Resolves Yes if (green) and Resolves No if (red), then the full rules and the facts (event window, trading cutoff, results due, opened at, if no result arrives: No, if voided: refunded); then Verification source with a Connected or "Placeholder · not connected" badge, how it counts and its link. The proof list is gone.
- **Venue page** (`/venues/<slug>`): the venue's mark, name, category and area, one line about it, then its open markets and its closed, resolved and void ones.
- **Sample label:** a small outlined tag in the accent wash wherever a sample appears (cards, the featured market, Closing soon, positions, the venue page), and a fuller note on its own page saying it is hypothetical, that Mitra has no partnership with the venue and that its early price history is demonstration data.
- **Suggest a market** and the owner's publish form reuse the existing form fields, with selects styled as fields and two-up rows that stack on a phone.
- **Positions:** each holding shows category · venue above its question; `/positions` adds a Trade history list.
- The owner's phone top bar drops the points figure when the Review link is present, so it fits at 375 pixels (it overflowed before this change).
