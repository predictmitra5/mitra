# Safety and integrity

Status: source requirements and pending policies; not a completed moderation policy or legal assessment.

## Source boundaries

PDF sections 2.1, 3.1, 8-10 and 18-20, pages 3-4, 7-8 and 13-14, require safeguards for real people, private information and market integrity. The platform must not rank people by protected characteristics or offer harmful/humiliating outcome markets.

The source lists death, injury, disease, mental health, self-harm, crime victimization, sexual activity, private relationships, protected characteristics, and coercive/humiliating outcomes as disallowed or strongly restricted. Exact eligibility and enforcement must be confirmed before opening market creation.

## Decided on 2026-09-15

- Consent: a person creates the goals about themselves, and the owner approves each market. Markets about someone proposed by other people are not approved.
- Self-dealing: subjects and people who decide an outcome cannot trade that market (Kalshi's influence rule).
- The owner rejects goals that can be achieved simply by deciding to.
- Visibility: anyone with the link can view market pages, and the user chose to let search engines index them, accepting that searching a person's name may surface their goals. Private evidence must never appear on those pages. Idea, not approved: let a subject keep an individual market out of search results.
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
