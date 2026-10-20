# Exchange replacement checkpoint — 2026-10-20

Status: **paused at the user's explicit request. This is unfinished source work, not a release candidate. Do not deploy it or apply migration 0019 yet.**

## Authoritative checkout and scope

- Checkout: `/Users/siyanshvirmani/Downloads/mitra/mitra`.
- Base: `9dd7982` (`docs: the YouTube-style home is live`). Preserve its video-first design and startup discovery experience.
- Work branch: `exchange-funding-closed-2026-10-20`.
- Plan commit: `58d1e5c`; a local WIP checkpoint commit follows this file.
- Full current user blueprint: `/Users/siyanshvirmani/.codex/attachments/ecd28477-959f-4fa6-aced-6f61eee2d78b/Pasted text.txt`. Its operative decision is also recorded at the top of `docs/DECISIONS.md`.
- Current authorization includes implementation, the guarded two-account reset, Supabase changes, push and deployment **after** verification and reset prerequisites. It excludes opening deposits, withdrawals or customer execution. The user later requested stopping now and documenting the checkpoint. Do not resume without a subsequent user request.

## Work currently in source

- `src/modules/exchange/engine.ts`: exact integer USD cents, whole binary contracts, best-price/FIFO matching at resting-maker price, partial fills, complementary fully backed pair issuance, held-contract sales, cancellation, reservations, idempotency, self-trade/conflict/cutoff checks, settlement/50-cent voiding, reversing journal primitives and reconciliation. No funding/grant command.
- `src/modules/exchange/store.ts`: singleton database row lock, double-entry append-only journal with a hash chain, JSON snapshot and verification; account and market projections. The database implementation has **not passed integration verification**.
- `readiness.ts`, funding API routes and order server action keep deposits, withdrawals and customer execution closed. No provider/custody workflow or launch authorization adapter is configured.
- Draft Drizzle migration `0019_closed_funding_exchange.sql` and generated snapshot/journal entry. Adds exchange storage and journal protections; proposes database triggers freezing legacy financial mutations so old deployments cannot keep granting/spending points. **Not applied to any hosted project.**
- Local auth/signup changes accept ordinary verified email, remove university selection/aliases, stop assigning owners by email during onboarding, and support a restricted market `?side=` return destination.
- Removed active shop/QR/currency modules and many obsolete LMSR/campus modules. Updated market reads, home cards, quotes, order ticket, account and portfolio to the new accounting path. Every open home card and shelf now has Yes/No entry points. No-offer and zero-funds states are being integrated.
- Removed demo financial simulation from the content seed. Discovery/demo content remains; deployed data has not been changed.
- Updated current AGENTS/DECISIONS guidance. Many historical docs/schema declarations/scripts and some comments still need retirement cleanup.
- Deleted tests asserting the retired economy/LMSR behavior. Replacement coverage is **incomplete**; restore equivalent account, moderation, lifecycle, discovery and browser coverage around the new design before calling this verified.

## Actual verification results

- Pure matching/accounting suite: **17 passed**.
- New email/return-destination policy suite: **3 passed**.
- Combined exchange/policy run: **20 passed, 5 skipped, 1 failed suite**. `store.test.ts` fails its migration setup because migration 0019 includes multiple SQL statements between Drizzle `--> statement-breakpoint` boundaries, which PGlite's prepared query rejects. The five storage/database tests never ran. First fix the migration boundaries, not the test assertions.
- Most recent typecheck failed on stale generated `.next` references to `/sandbox`, missing live-quote fields, a stale moderation function name and old lifecycle position references. Several source errors were then patched, but typecheck was **not rerun** before the stop request. Clean/move the verified generated `.next` output and rerun after finishing source integration.
- Full test suite, lint, production build and desktop/mobile browser walkthrough: **not run for this checkpoint**.
- `git diff --check`: passed before this documentation checkpoint.
- No push, production deployment, hosted migration, account deletion or reset occurred during this exchange-replacement task.

## Verified hosted identities and read-only inventory

- Supabase: `uexxnlgchhdbbomdaxgg`, name `kalshiforpeople`, organization `yjorkveifmcyrvrlmjbr`, region `ca-central-1`, Postgres 17.
- Vercel: team `mitra25` / `team_CIUW0sYGQg2AJMcqKMqKjkqF`, project `mitra` / `prj_VNwaRvjgz0C4FaO6rCvPcTHCjV20`, domain `mitra-gamma-ten.vercel.app`. Its exact Git-link configuration, per-environment variables and currently aliased production deployment still require verification; latest-deployment metadata is not proof of the active domain alias.
- Retain owner `predictmitra@gmail.com`: Auth UUID `6b64e355-844f-4bf4-88ba-9781bd5bdc66`, verified email, profile `mitrapredict`, `is_owner=1`.
- Retain owner `murugan.23@osu.edu`: Auth UUID `ffaf0f4e-dec8-400f-b542-388660a43b8c`, verified email, profile `ducky`, `is_owner=1`.
- Other real Auth identity: `virmani.20@osu.edu`, UUID `6715c2a0-6a59-42e9-952a-93c69e8813c4`. User confirmed only the two owners should survive. Do not delete identity rows with direct SQL; use supported Auth administration and revoke sessions.
- Read-only counts: 3 Auth identities; 74 profiles (2 real owners + 72 fictional demo profiles); 20 founders; 20 startups; 30 videos; 40 markets; 1,263 legacy ledger entries; 1,130 legacy trades; 830 legacy position rows; 1,168 old price-history rows; 0 purchase records; 0 QR claims.
- Queried public/storage RLS-policy inventory returned no policies, and public routines inventory returned `rls_auto_enable` (SECURITY DEFINER). This alone does not establish table exposure/grants/RLS safety; complete the inventory.
- Storage buckets observed: evidence-public (public), evidence-originals, profile-photos and photo-uploads (private). No Storage objects were deleted. Startup-media bucket existence/configuration needs verification.
- The user replied “yes, only [two emails]” to a bundled account/deletion/backup question. This establishes the retained-account choice but is **not independent verification of a current recoverable backup**. No recovery artifact or restore rehearsal was created. Backup and a concrete reset dry-run remain prerequisites.
- `.env.local` is absent in the authoritative checkout. Do not print or ask for secrets. Connected MCP database access works; supported Auth/settings/Storage administration may require the existing authenticated dashboard or authorized CLI environment provisioning.

## Resume order / work remaining

1. Finish and review the source integration. Repair migration statement boundaries, stale generated route types, remaining source references/imports and formatting. Finish independent Yes/No quote/state handling across every card surface and retain side selection through sign-in **and new-user onboarding**. Review feed/live polling for accidental placeholder-price display. Remove misleading legacy P&L/market-opening claims.
2. Validate engine/store thoroughly: database lock/concurrency races, partial fill/cancel races, journal/hash stability after JSONB round trips, atomic lifecycle settlement, voiding, finality, owner/founder exclusions, immutable terms, matching restrictions, reconciliation and funding closure. The current hard-closed submit boundary rejects all customer orders; any eventual path to matching needs the verified launch/eligibility/settled-custody arrangement, never a permissive environment switch. Correction primitives have no public authorization workflow.
3. Restore meaningful coverage replacing the deleted legacy tests; run the entire suite, typecheck, lint and production build serially where `.next` generation overlaps. Verify both fresh migration history and upgrade from 0018. Exercise UI at desktop/mobile against an isolated database and permitted fixtures, never live financial statistics.
4. Finish retirement: legacy schema objects/columns, old one-time go-live/reset/preview scripts, dependency/environment references, current docs and branded email templates. Historical migrations/Git history must remain intact. Do not blindly remove content biographies. Inspect Supabase functions/triggers/RLS/grants/jobs/Auth hooks/settings/Storage and Vercel Production/Preview/Development config. Never blindly rerun the old reset script.
5. Produce a scoped deletion dry-run, current recoverable export and documented/rehearsed restoration. Confirm no actual customer-money records are being erased. Preserve owner access/roles, startup/founder/video content and fictional discovery content. Remove retired economy activity/derived metrics and the extra real Auth identity within scope. Owners' new monetary balances must remain zero. Do not convert or regrant legacy balances.
6. Only after all required checks and reset prerequisites: compatible controlled hosted migration/reset sequence, verify old deployed mutation paths cannot write, commit/push with global email `predictmitra@gmail.com`, deploy through the existing Vercel project, and verify live behavior/accounting. Do not rewrite Git history or open funding/trading.
7. Document external launch decisions: entity and selected regulatory/partner route, permitted products, customer-funds/custody setup, verified identity/geography, surveillance, disputes and launch authorization. Current software is not evidence of legal approval. Authoritative CFTC DCM/core-principle pages were consulted, but no operating arrangement has been supplied or verified.

Funding setup alone does not complete these implementation and launch requirements.
