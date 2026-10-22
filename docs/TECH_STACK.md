# Technical foundation

> Current stack: Next.js/React/TypeScript, Supabase Auth/Storage/Postgres and Drizzle, plus the internal USD-cent order-book/journal core. Funding/customer execution are closed. The unused Anthropic SDK, QR dependency, preview impersonation and old go-live scripts were removed in the 2026-10-20 replacement; conflicting implementation descriptions below are historical. See [EXCHANGE_STATUS.md](EXCHANGE_STATUS.md).

Selected: 2026-09-15, under the user's explicit delegation of technical choices. Scaffolded the same day (see Implemented foundation). Hosting: Vercel, chosen by the owner on 2026-09-24, private behind Vercel Authentication at first; functions run in `yul1` (Montréal), the same AWS region as the Supabase database (ca-central-1). See README.md, Deploying on Vercel.

## Selected components

| Component | Choice | Reason |
| --- | --- | --- |
| Web application | Next.js App Router, React, TypeScript | One typed codebase for the mobile-first website and initial server endpoints |
| Database | PostgreSQL on Supabase | Relational constraints and transactions for auditable market, evidence and event records |
| Authentication | Supabase Auth | Integrated identity/session service with supported Next.js integration. The OSU/UIUC domain gate and campus match are enforced and tested in application code; Supabase supplies the verified six-digit email OTP session |
| Evidence file storage | Private Supabase Storage | Restricted object access for the user-approved private-document capability; visibility/retention rules still require decisions |
| Server data access/migrations | Drizzle | Explicit transactional SQL-oriented access and generated SQL migrations that can be reviewed |
| Initial deployment shape | One web application with separate domain modules | Reduce coordination while keeping market, information and discovery responsibilities distinct |
| AI goal suggestions | Anthropic Claude API (model `claude-haiku-4-5`), called only from server code | The user chose AI-written goal suggestions alongside templates (2026-09-15). Drafting a few goal options from a short profile is a small, structured task, so the cheapest current Claude model fits: $1 per million input tokens and $5 per million output. Do not use an Opus- or Fable-tier model here. Google's Gemini Flash-Lite is cheaper still but adds a second provider and account for a few cents a month at pilot scale. The user creates the API key and billing account; prompt, inputs sent, retention and spending limits are set at implementation |

No separate API service, ML service, analytics SaaS or background-job system is selected. Vercel's free Hobby plan is expected for the pilot; the plan is the owner's choice.

## Implemented foundation (2026-09-15)

| Piece | Version | Notes |
| --- | --- | --- |
| Node.js | 24.19.0 LTS | Installed with winget on the development machine, with the user's permission |
| Next.js | 16.3.5 | Created with create-next-app 16.3.5: App Router, `src/` directory, `@/*` import alias, Tailwind CSS 4, ESLint 9 |
| React | 19.2.8 | Pinned by create-next-app |
| TypeScript | 5.x | Scaffold default. TypeScript 7 is released but has not been evaluated with this Next.js version |
| Vitest | 5.0.1 | Unit tests; configuration in `vitest.config.mts` |
| @types/node | 24.x | Matches the Node runtime; Vitest 5 requires 22 or newer |
| @supabase/ssr, @supabase/supabase-js | 0.12.7, 2.116.0 | Cookie-based Supabase Auth sessions in server code; added 2026-09-16 |
| server-only | 0.0.1 | Build fails if server modules such as the database client are imported by client code |
| @electric-sql/pglite | 0.5.8 (dev only) | In-memory PostgreSQL for account-provisioning tests; single connection, so it cannot prove hosted concurrency |

Next.js 16 replaces `middleware.ts` with `src/proxy.ts`, per the bundled `proxy.md` file convention. Here it only refreshes Supabase session cookies; every page and action verifies identity itself.

- Next.js 16 generates global route types such as `LayoutProps`. `npm run typecheck` runs `next typegen` before `tsc`, as the bundled Next.js CLI documentation recommends.
- This Next.js version ships its documentation in `node_modules/next/dist/docs/`. Read the relevant guide before using Next.js APIs.
- Installed 2026-09-15: `postgres` 3.4.9 (driver), `drizzle-orm` 0.45.2 and `drizzle-kit` 0.31.10. The Anthropic SDK is not installed yet; add it with the goal-suggestions feature.
- npm reported that ESLint 9.39.5 is no longer supported, and that the `unrs-resolver` install script was not run under npm's allow-scripts policy. Lint passes; revisit when eslint-config-next supports a newer ESLint.

## Tradeoffs

Supabase reduces the number of independently integrated services but creates provider dependence in authentication and storage. The core relational data and explicit SQL help maintain a migration path. Integrated services do not eliminate application authorization or make a ledger correct by themselves.

A separate backend could be useful for future long-running processing, but adds deployment/API coordination now. Clerk/Auth.js and Prisma are viable alternatives; they are unnecessary for the current requirements. Drizzle is an engineering preference for explicit SQL, not a claim that Prisma cannot support the app.

## Verified implementation constraints

- Next.js documents Windows support and current installation minimums. Recheck version-specific requirements at setup. [Official installation guide](https://nextjs.org/docs/app/getting-started/installation)
- Use an appropriate PostgreSQL connection strategy. Supabase transaction pooling suits short-lived/serverless workloads; disable prepared statements for that mode, bound per-instance connections, and do not depend on session state surviving across transactions. Use a suitable separate migration connection. [Official connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Verified 2026-09-15 on this machine: the transaction pooler (port 6543) and the session pooler (port 5432) both connect, while the direct host `db.<ref>.supabase.co` fails with ENOTFOUND because it resolves over IPv6 only. Use the session pooler for migrations rather than the direct host.
- Validate server identity with the documented claims/user checks. Do not authorize sensitive operations by trusting an unvalidated session object alone. [Official SSR setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
- Storage supports row-level access policies. Service credentials bypass these protections and must remain server-only. A server using privileged access must enforce user permissions explicitly. [Official storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- Drizzle supports explicit transactions/isolation and generated migrations. The eventual ledger still needs application invariants, constraints, retry handling and concurrency tests. [Transactions](https://orm.drizzle.team/docs/transactions), [migrations](https://orm.drizzle.team/docs/migrations)

Uploads never pass through the app's own server (since 2026-09-24). Vercel refuses request bodies over 4.5 MB, while proof may be 10 MB and photos 8 MB, so a server action hands the browser a one-time Supabase signed upload link for one path (it lasts two hours and cannot overwrite), the browser sends the file straight to storage, and a second action reads it back and checks it before recording it. Server actions are back at Next.js's default 1 MB limit. Supabase Storage answers browsers' cross-origin checks for these uploads; verified with a probe on 2026-09-24. (Before 2026-09-24 the limits were raised to 11 MB for uploads through actions; before that, any proof above 1 MB was refused.)

Do not assume hosted request handlers support indefinitely running jobs or persistent connections. Select that infrastructure only when verification rechecks, asynchronous review or other concrete requirements justify it.

## Mitra's website (2026-10-20)

`site/` is its own Next.js 16.3.5 project (React 19.2.8, TypeScript, ESLint with `eslint-config-next`), so it can be deployed and changed apart from the app: a second Vercel project, `mitra-site` in the team `mitra25`, with Root Directory `site`, served at https://mitra.market since 2026-10-21 (first at https://mitra-site-ten.vercel.app), with the app at https://app.mitra.market. The domain was bought through Cloudflare, so its DNS stays at Cloudflare with the records Vercel names set to DNS only. Both projects build on every push to `main` (commits authored as predictmitra@gmail.com, as for the app). `next.config.ts` sets Turbopack's and file tracing's root to that folder, because the app's lockfile one folder up would otherwise be taken as the workspace. Its motion uses `gsap` 3.15.0 (ScrollTrigger and SplitText, free since 3.13) and `lenis` 1.3.26 (1.3.27 was five days old when installed); icons are `lucide-react` 1.48.0, as in the app; Geist comes through `next/font`. It is plain CSS (`site/src/app/globals.css`), no Tailwind. The page is prerendered as static HTML. `NEXT_PUBLIC_APP_URL` points its links at the app (default https://app.mitra.market since 2026-10-21; https://mitra-gamma-ten.vercel.app before). Nothing in it reads the database or any secret.

## Founder videos and request limits (2026-10-21)

- **YouTube.** Founder videos are YouTube links (DECISIONS.md 2026-10-21). `src/modules/startups/youtube.ts` reads the id from any YouTube link and asks YouTube's oEmbed endpoint (no key, 4-second timeout, failing open) whether the video exists and may be embedded; `src/app/components/startup/youtube-player.tsx` loads YouTube's IFrame Player API (`https://www.youtube.com/iframe_api`) once per page and plays on `https://www.youtube-nocookie.com`. No YouTube Data API key is used or needed.
- **Request limits.** `src/modules/security/rate-limit.ts` counts requests per rule, subject and fixed window in Postgres (`rate_limits`, migration 0021) with one `insert … on conflict do update … returning`, so every Vercel instance shares the count; `request.ts` takes the address from `x-forwarded-for` (which Vercel overwrites) and wraps server actions and route handlers. Subjects are HMAC-SHA-256 hashes keyed by `RATE_LIMIT_SECRET`, or `SUPABASE_SECRET_KEY` when that is unset. A database error lets the request through. The daily maintenance route deletes windows older than a day. No Redis or Vercel firewall rule is needed.
- **Browser headers.** `next.config.ts` (and `site/next.config.ts`) send `frame-ancestors 'none'`, X-Frame-Options DENY, nosniff, a strict-origin referrer policy, a permissions policy switching off camera, microphone, location, payment and USB, two-year HSTS with subdomains, and (app only) `form-action 'self'` and a same-origin opener policy; `X-Powered-By` is off. There is no script-source CSP yet: it would need nonces on every page and an allowance for YouTube's player script.
- **Telling a Short (2026-10-22).** `describeYoutubeVideo` asks oEmbed about `https://www.youtube.com/shorts/<id>`: YouTube then reports a Short's own shape (113 × 200) and an ordinary video's (200 × 150); asked with the ordinary watch address it reports a Short as wide. A `youtube.com/shorts/` link is a Short without asking. Founder image uploads are on wherever the Supabase server keys are set (`STARTUP_MEDIA_UPLOADS=off` turns them off), once `media-uploads` and `startup-media` exist.
- **Resumes and invites (2026-10-22).** Resumes live in the private Supabase Storage bucket `founder-files` (PDF only, 5 MB; `scripts/setup-evidence-storage.mjs founder-files` creates just that bucket) and are checked by `src/modules/startups/pdf-check.ts`; visitors get five-minute signed links. Co-founder invite codes use Node's `randomBytes(32)` and SHA-256; join passwords Node's built-in `scrypt` (N 16384, r 8, p 1, 16-byte salt) and `timingSafeEqual`, so no new package was added.
- **No query pipelining (2026-10-22).** The app reaches Postgres through Supabase's transaction pooler (port 6543) with postgres.js, `prepare: false` and `max_pipeline: 0` (`src/db/client.ts`; the option is missing from postgres.js's types, so it is passed in a variable). With pipelining on, a batch of concurrent queries mixing one without parameters and parameterized ones (which postgres.js sends as describe, then execute) can hang for good through the pooler; measured on the live database, the owner's waiting count hung in about a third of calls. Keep it at 0 unless the pooler changes.
- **Never run `drizzle-kit push`** against the hosted database: row-level security is switched on in hand-written migration SQL, so the Drizzle snapshots record every table as `isRLSEnabled: false` and a push could try to switch it off. Generate migrations (`drizzle-kit generate`) and apply them.

## Not decided by this document

Market mechanics, economy parameters, subject consent, outcome resolution, evidence retention, ranking formula, data schemas and reviewer autonomy remain product choices. The user has accepted public and private evidence categories; they have not approved a particular file-retention policy or external AI processing of that evidence.

The owner created the Supabase project and a workspace-scoped Claude API key on 2026-09-15 and placed the credentials in `.env.local` themselves; all four connections were verified. Storage buckets exist since 2026-09-19 and 2026-09-24 (see README.md). Deployment is prepared for Vercel; the owner creates the project and enters the keys.
