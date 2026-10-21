# Exchange replacement — current implementation and rollout

Updated 2026-10-20. This supersedes the paused checkpoint and conflicting campus/virtual-economy instructions. It is not a real-money launch approval.

## Current product

Preserve the existing video-first UI, founder/startup profiles, videos, search, follows, saves, comments, reports and moderation. Ordinary verified email is accepted. There is no university eligibility, coin purchase, QR reward, top-up or account grant. Legacy preview-persona impersonation and broken campus/coin go-live scripts were removed; Git history preserves their source.

The owner requested a few existing markets per category, not exactly nine. The selected catalog had two existing open fictional markets per industry (20 across ten industries). On 2026-10-21 the owner had three of them hidden as easy to fake (Driftlight's Steam release, Loop Closet's second city, Ferro Labs' Kickstarter) and six hidden open ones listed that someone else decides (Lumenly's Y Combinator, Nexa's Open Automation Prize, Draftboard's acquisition, Parallax AI's Foundry accelerator, Verdant Grid's Gridshift Prize, Carbonfold's Material Futures Challenge): 23 listed, between one and four per industry, by `scripts/catalog-listing-2026-10-21.sql` with the same preservation checks and its own owner audit entry (`catalog_listing_2026_10_21`, holding the previous listing). DECISIONS.md 2026-10-21. A `listed` flag hides other definitions without deleting terms or changing statuses. `scripts/catalog-curation-2026-10-20.sql` records previous listing values in a private owner audit entry and asserts every other market field is unchanged. Its isolated test verifies restoration. Hidden definitions and all startup/founder/video content remain in the database.

Both Yes/No controls appear on eligible open cards. Quotes are independent executable offers, not complements of the opposite purchase price. Empty books show No offer; no executions means zero volume and no last-trade chart. Side choice survives the ticket, authentication prompt and onboarding steps. Old demo terms containing coin or missing-data-No rules require review/republication before any funded contract can open; the original database text is preserved, not silently edited. The UI does not advertise those retired terms as current contracts.

## Exchange boundaries

- Exact integer USD cents, whole binary contracts, maker-price execution, best price then FIFO, partial fills and cancellation.
- Complementary purchases put exactly $1 per pair into escrow. Existing contracts can transfer without minting collateral. No unsupported shorting.
- Available/reserved funds and contracts, retry keys, self-trade rejection, cutoff/paused checks, owner/founder/decision-maker restrictions.
- Append-only balanced journal, hash verification after JSONB round trips, reconciliation and a global transaction lock preventing cross-market double spending. The global lock is an intentional low-throughput implementation, not an exchange-scale performance claim.
- Winning contracts settle at $1; losing contracts at $0. Voiding cancels open orders and pays $0.50 per fully collateralized contract. Missing information does not establish No. Corrections are reversing-entry primitives with no public adjustment endpoint.
- **Deposits, withdrawals and all customer execution remain hard-closed.** No environment flag, owner button or payment callback enables them. All new accounts have zero money. Test collateral exists only in disposable local fixtures.

Before execution can open, a separately reviewed provider/authorization implementation must verify customer eligibility, actual settled custody backing and launch authorization while holding the appropriate database locks. A payment notification alone must not create spendable balances. Ordinary email and an 18+ self-attestation are not financial KYC or verified eligibility.

## Hosted inspection and changes

- Supabase: `uexxnlgchhdbbomdaxgg` / `kalshiforpeople`, organization `yjorkveifmcyrvrlmjbr`, ca-central-1.
- Vercel: `mitra25`, project `mitra` / `prj_VNwaRvjgz0C4FaO6rCvPcTHCjV20`; GitHub `predictmitra5/mitra`, main; public domain `mitra-gamma-ten.vercel.app`.
- On resumption, the public alias already served WIP `7f359f2`, but exchange tables were absent. Additive Drizzle migration 0019 was applied and recorded in the existing Drizzle history. It creates the journal/snapshot with RLS and revokes browser access; freezes writes to 14 existing retired financial/QR/sandbox tables. No existing rows were deleted or converted. Supabase's migration tool records an operational audit of the same checked-in Drizzle SQL, not an alternate schema pipeline.
- 0018's recorded hash differs only because the hosted SQL used CRLF and the checkout uses LF. Both encodings were hashed and matched exactly; its existing record was preserved.
- Migration 0020 adds reversible catalog visibility. The applied hash is `c7e592b6a407081264198b2e159c80251926bc2691dde35ef5a00f181abd3323`.
- Curation was applied through the migration tool after two execute-SQL attempts returned expired-request errors without changes. Direct readback confirms 20 listed markets, exactly two per industry. The atomic curation verified all 40 definitions' other fields unchanged and stored previous visibility in the owner audit. No app-side fallback or hardcoded-ID catalog filter was added.
- After 0019, public home returned 200; deposit/withdrawal POSTs returned 409 FUNDING_CLOSED; shop and owner campaigns returned 404. New financial journal had zero entries. No customer funds or orders were created.
- Security Advisor reported informational RLS-with-no-policy notices (intentional server-only access) and a warning that Auth leaked-password protection is disabled. No policy was weakened to make the app work.
- Production has the required Supabase/Postgres variable names. Preview has APP_URL but no corresponding database/Auth configuration; Development has no listed app configuration. No values were printed or copied, and no unnecessary access was widened. No exclusively retired hosted variables were found. Media-upload activation is absent; existing founder media buckets are not configured.

## Reset dry-run — not executed

User explicitly confirmed there is **no current recoverable backup**. The required backup/restore prerequisite is therefore unmet. There is no ignored local environment file with credentials, and the connected Supabase tool exposes neither Auth deletion nor Auth/settings/Storage administration. A normal connector connection is not a backup or an Auth-admin credential. Browser work did not establish an authenticated Supabase dashboard session; no reconnection was initiated.

Retain both verified, active owner profiles:

- `predictmitra@gmail.com`: `6b64e355-844f-4bf4-88ba-9781bd5bdc66`.
- `murugan.23@osu.edu`: `ffaf0f4e-dec8-400f-b542-388660a43b8c`.

Other real Auth identity authorized for deletion: `virmani.20@osu.edu`, `6715c2a0-6a59-42e9-952a-93c69e8813c4`. It has no application profile in the inspected state. Do not delete Auth rows directly with SQL. Revoke sessions and use supported Auth administration after recovery is verified.

Read-only inventory: 3 Auth identities, 74 profiles (2 real owners and 72 fictional demo profiles), 20 founders, 20 startups, 30 videos, 40 market definitions, 1,263 retired ledger rows, 1,130 trades, 830 positions and 1,168 price-history rows. Purchases and QR claims are empty. These old virtual records are quarantined, not converted into new money or used in live exchange statistics. This is not a completed historical-data reset.

Storage contains evidence-public (public), evidence-originals, profile-photos and photo-uploads (private). No objects or buckets were removed. Review scoped objects against the retained owners and preserved content before deletion. A database backup does not back up Storage object bytes.

To finish the reset: provision a current private export/backup through the owner's normal Supabase workflow, verify restoration on an isolated database, refresh the dry-run and inspect for genuine monetary records, then delete the extra Auth identity through supported administration. Clear/drop only retired economy objects after dependency review, preserving current content, both owner roles, new exchange accounting and the catalog audit. Do not rerun `scripts/reset-production-2026-10-13.sql`.

## Remaining external verification

- Publish the neutral `supabase/templates/verification.html` to both hosted signup and magic-link templates; a Git push does not do this. Existing SMTP settings were not changed. Controlled ordinary-email OTP delivery and real owner sign-in have not been observed.
- Configure media buckets/provider activation if actual founder uploads are desired; preserve existing demo playback.
- Back up and reset retired data/accounts as above. Retired schema declarations remain deliberately until protected removal is possible.
- Verify concurrent transactions against independent PostgreSQL connections and load-test before a financial launch; local PGlite integration tests are not a production concurrency certification.
- Finalize the legal entity, regulated operating route/partner, permitted contract products, custody/clearing/customer-funds arrangement, KYC/AML and geography, surveillance/insider controls, disputes and record retention. None is supplied or approved by the software.

Authoritative references reviewed 2026-10-20: [CFTC DCM oversight](https://www.cftc.gov/IndustryOversight/TradingOrganizations/DCMs/index.htm), [DCM application process](https://www.cftc.gov/IndustryOversight/TradingOrganizations/DCMs/dcmhowto.html), [economic/product requirements](https://www.cftc.gov/IndustryOversight/ContractsProducts/EconomicRequirements/index.htm), [prediction-market overview](https://www.cftc.gov/LearnandProtect/PredictionMarkets). These describe exchange/market-integrity obligations; they do not establish that Mitra or these startup markets are authorized. The applicable arrangement needs qualified counsel and the actual partner/regulator's requirements, not a generic checklist.

## Publication record

Local verification: 185 tests across 25 suites pass, including fresh migration history, upgrade from 0018, JSONB journal hashing, concurrent reservation attempts, lifecycle settlement, ban/owner checks, catalog restoration, card controls and independent quotes. Typecheck, lint and `git diff --check` pass. The final production bundle passes `next build --webpack`. Default Turbopack could not run locally because its CSS worker could not bind a process port; the first restricted run also could not fetch Geist. This is recorded rather than reported as a successful default local build.

Before publication, public desktop/mobile browsing confirmed the existing layout, ordinary open-card controls, selected No ticket and correct sign-in return URL. No real OTP or authenticated owner walkthrough was performed. See docs/EXECUTION.md for final source/deployment verification. Until a verified reset is recorded there, do not describe the entire cleanup as complete.

Published implementation: `ab613a2` on GitHub main, author/global email `predictmitra@gmail.com`. Vercel production `dpl_BGbedx93KGcaDJvvHpSujddQARU3` reached READY and served the public alias. Post-deploy desktop (1440 px) and mobile (390 px) checks confirmed 20 unique market routes, independent No-offer controls, selected No, its preserved sign-in destination and the neutral footer. Home/directory returned 200; both funding POSTs returned 409; retired shop/campaigns returned 404. No error/fatal groups appeared in the scoped 10-minute runtime-log check. This does not verify unexercised authenticated or inbox flows.
