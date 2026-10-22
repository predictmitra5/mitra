# Safety and integrity

> **2026-10-19, startup markets.** New risks: founders or their teams trading on what they know or steering a milestone to win; the feed promoting a founder to move a market; reviewers and viewers mistaking demo or self-reported facts for verified ones; harmful or misleading videos and comments; a visitor's watching being tracked. Built: a startup's founders and registrant cannot trade its markets, and neither can the owner accounts (2026-10-07); founders cannot manage, pause or resolve markets; the recommendation receives no market data (a test enforces the separation); founders, startups and every video wait for owner approval; four verification levels shown beside facts; Demo labels on every demo startup, founder, video, market and trader; reports on videos, comments, startups, founders and markets, with owner removal of comments and an audit trail at `/review/audit`; comments limited to 1,000 characters and 30 an hour; visitors identified only by a random cookie, their events capped per hour and deleted after 60 days; uploaded images re-encoded to strip metadata, and every founder upload reserved as an upload intent with a per-person limit and a 48-hour expiry swept daily (uploads off until the buckets exist). Not built: blocking a startup's employees or investors, any identity check of founders, automatic moderation, or a block on a startup's employees and investors.

> **2026-10-08, event markets.** Markets no longer name people. New risks: someone buying at a venue, or getting others to, to move a market; venue staff trading on what they see; sample markets on real businesses being read as real data; and a bar's drink count being traded by members who are 18 to 20. Mitigations built: every market's rules ask people not to buy at the venue to move it and not to trade a venue where they work; samples say they are hypothetical and unverified everywhere they appear; the 100-point per-market limit; owner review of every suggestion; recorded outcome deciders cannot trade. Not built: any check of who works where, or an age gate on particular markets. The owner decided the Midway on High drink sample stays for the 18+ audience ("its 18+", DECISIONS.md, 2026-10-08).

Status: source requirements and pending policies; not a completed moderation policy or legal assessment.

## Source boundaries

PDF sections 2.1, 3.1, 8-10 and 18-20, pages 3-4, 7-8 and 13-14, require safeguards for real people, private information and market integrity. The platform must not rank people by protected characteristics or offer harmful/humiliating outcome markets.

The source lists death, injury, disease, mental health, self-harm, crime victimization, sexual activity, private relationships, protected characteristics, and coercive/humiliating outcomes as disallowed or strongly restricted. Exact eligibility and enforcement must be confirmed before opening market creation.

## Decided on 2026-09-15

- Consent: a person creates the goals about themselves, and the owner approves each market. Markets about someone proposed by other people are not approved.
- Self-dealing: subjects and people who decide an outcome cannot trade that market (Kalshi's influence rule).
- The owner rejects goals that can be achieved simply by deciding to.
- Visibility (2026-10-05): the feed, goal pages, prices and profile photos are readable by anyone, as they were before 2026-10-04; trading and every write still need a verified campus identity. Goal pages are marked no-index. Profile photos are cached only by the browser, so a removed or banned person's photo stops being served at once. Private evidence must never appear on any page.
- Provisional: friends may trade on their own knowledge with a per-market maximum, and the owner may cancel colluders' trades. The user requested more research. A subject deliberately failing so a friend's NO position wins remains a known risk.
- AI goal suggestions send what a subject types to an AI provider. Recommended, not yet approved: tell subjects before they use it, and never send evidence documents.
- Accounts use email and password (chosen by the owner on 2026-09-16). Users confirm they are 18 or older before a profile or grant is created; the server records when. This is self-attestation: it deters minors but does not verify age, and no birth date or identity document is collected.
- Implemented 2026-09-16: non-OSU accounts are never admitted by the app, but Supabase itself will still create them if someone calls its sign-up API directly. A provider-side auth hook would stop that; not built.
- Supabase's built-in email delivers only to the project team, so confirmation and reset emails cannot reach students until the owner configures custom SMTP.
- Sign-in at launch is limited to verified `@osu.edu` and `@illinois.edu` addresses. This reduces anonymous accounts but excludes friends outside those campuses, does not verify age, and does not establish that an account holder is the person a market concerns. Supabase Auth does not enforce the campus match by itself; application code does, and it is tested.
- The owner sets each market's opening price at approval, which is an editorial judgement about a real person and should be recorded with the approval.

## Consent and privacy decisions

Confirm how the 18+ expectation is checked and how consent is evidenced. Define claiming, impersonation review, blocking, reporting, profile deletion and market removal. Do not silently add a public-figure exception.

Distinguish withdrawing consent, removing public visibility, stopping new trades, retaining accounting records, deleting private evidence and settling/cancelling existing positions. These actions have different effects and need a coherent policy before markets open.

Private evidence requires explicit access, redaction, retention and deletion rules. Audit requirements are not an automatic justification for retaining raw personal evidence indefinitely.

## Integrity considerations

The source calls out wash trading, bots, sybils, coordinated manipulation, self/related-party trading, fake information, brigading, spam and harassment. Simple controls may be sufficient for a pilot, but their product effects need agreement: limits, identity checks, suspicious-activity flags, restrictions, pauses and review.

Distinguish truthful negative information, honest mistakes, unsupported claims, materially misleading claims and deliberate fraud. No automatic market cancellation follows merely from a false update. Corrections, sanctions and appeals require recorded reasons and authorized actors.

## Acceptance criteria after decisions

- Tests exercise permission boundaries for ordinary users, subjects and administrators.
- Evidence URLs and APIs enforce the chosen access restrictions.
- Market and verification changes preserve actor/reason/time history under the retention policy.
- Reports cannot silently become unconditional feed suppression unless that policy is chosen; brigading is a relevant failure case.
- Admin operations are available through reviewed workflows, not routine direct database edits.
- Secrets stay outside source control, public responses and event payloads.

## Security review, 2026-10-21

At the owner's request the whole site at e387cbd was reviewed with the `security-review` skill: four read-only reviewers by area (sign-in, sessions and owner tools; money, markets and their endpoints; founder content, uploads and social features; database, configuration and the website), then each candidate finding checked separately for false positives.

- **No high-severity finding.** Nobody could be shown to bypass sign-in, reach owner tools, act on another member's records, follow a return link off the site, inject SQL or script, or create money: deposits, withdrawals and order execution stay hard-closed. Every one of the live database's 43 tables has row-level security and there are no policies in `public` or `storage`, so the browser key reads nothing (checked read-only on the live database). No key or password is in any tracked file or in the history.
- **Fixed:** a founder's page listed updates about their startups the owner had not approved (or had suspended), naming the startup, and search could name such a startup beside an approved founder (`readFounderPage` and `search.ts` now join approved startups only; a test covers it). A product feature typed as `constructor` crashed every thumbnail drawing it (`glyph.tsx` now looks up own keys only).
- **Hardened:** request limits (TECH_STACK.md) on sign-in, sign-up codes and their checks, password resets, onboarding, account deletion, every founder write and handle check, likes, saves, follows, comments, reports, uploads, the feed's load-more, comments reads, `/api/events` and `/api/quotes`; protective browser headers; Secure auth cookies in production; a constant-time check of the maintenance route's secret; a sign-up whose emailed code proves the mailbox now replaces any password set earlier through Supabase's public sign-up endpoint and ends other sessions, and setting the password ends other sessions too; founder @handles can no longer copy another member's username. Migration 0021 also takes Supabase's default table privileges away from the browser roles on every current and future table in `public`, so row-level security is no longer the only barrier.
- **Left for the owner:** after approval, a founder's edits to their profile or startup go live without a second review (the owner's 2026-09-24 rule for photos already works that way; DECISIONS.md does not say for the rest). Before Mitra's own uploads are switched on, uploaded files need staging and removal on rejection (today they would be public at once and survive a rejection); videos are YouTube links, so only images remain. Supabase's leaked-password protection is off (Security Advisor).

## Co-founder invites and resumes (2026-10-22)

- **Invites.** Joining a startup's team takes both the link and the join password. The link's code is 256 random bits kept only as a SHA-256 hash; the password only as a salted scrypt hash, compared in constant time. An invite is for one account, works for 7 days, locks after 5 wrong passwords (counted under a row lock, so parallel tries can't exceed it) and can be cancelled by the team; it also stops working when the founder who made it (or the account that unlocked it) is banned or deletes their account; a startup has at most 5 waiting. Join attempts also count against a request limit by address and account. The inviter can't use their own invite. The join page and the invite screens send no referrer and are not indexed. A co-founder who joins becomes one of the startup's founders, so the rule that founders can't trade their startup's markets covers them; their founder profile still waits for the owner's approval.
- **Resumes.** Only PDFs the server has read and checked (a PDF header and end, at most 5 MB, nothing that runs or attaches files) are kept, in a private bucket. Visitors reach a resume only through `/founders/<handle>/resume`, which, once the owner has approved the founder (before then only for the founder and the owner), redirects to a link on Supabase's domain that expires after five minutes. A founder can only save a resume from their own upload folder; a replaced or removed resume is deleted; unsaved uploads are deleted by the daily cleanup; account deletion deletes it.
- **Founder pictures** come only from the member's own profile-photo upload (which re-encodes photos and refuses AI-labelled images), so nobody can show another member's photo as theirs; a picture pasted before 2026-10-22 is kept while unchanged. A photo is required before a video.
- **Checked separately** with an independent read-only review of the new code on 2026-10-22: nothing exploitable found. Below its bar and left as they are: a banned founder's resume still opens (as their founder page still shows), and the PDF check reads raw bytes, so scripts hidden in compressed streams can pass it (the file is only ever served from Supabase's domain).
