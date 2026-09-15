# Technical foundation

Selected: 2026-09-15, under the user's explicit delegation of technical choices. Scaffolded the same day (see Implemented foundation). Nothing is hosted.

## Selected components

| Component | Choice | Reason |
| --- | --- | --- |
| Web application | Next.js App Router, React, TypeScript | One typed codebase for the mobile-first website and initial server endpoints |
| Database | PostgreSQL on Supabase | Relational constraints and transactions for auditable market, evidence and event records |
| Authentication | Supabase Auth | Integrated identity/session service with supported Next.js integration. The launch restriction to Ohio State email addresses is not a Supabase setting; enforce and test it in application code or an auth hook |
| Evidence file storage | Private Supabase Storage | Restricted object access for the user-approved private-document capability; visibility/retention rules still require decisions |
| Server data access/migrations | Drizzle | Explicit transactional SQL-oriented access and generated SQL migrations that can be reviewed |
| Initial deployment shape | One web application with separate domain modules | Reduce coordination while keeping market, information and discovery responsibilities distinct |
| AI goal suggestions | Anthropic Claude API, called only from server code | The user chose AI-written goal suggestions alongside templates (2026-09-15). Provider selected under technical delegation. Model, prompt, which subject inputs are sent, retention and spending limits are set at implementation. The user must create the API key and billing account |

No separate API service, ML service, analytics SaaS, background-job system or hosting subscription is selected.

## Implemented foundation (2026-09-15)

| Piece | Version | Notes |
| --- | --- | --- |
| Node.js | 24.19.0 LTS | Installed with winget on the development machine, with the user's permission |
| Next.js | 16.3.5 | Created with create-next-app 16.3.5: App Router, `src/` directory, `@/*` import alias, Tailwind CSS 4, ESLint 9 |
| React | 19.2.8 | Pinned by create-next-app |
| TypeScript | 5.x | Scaffold default. TypeScript 7 is released but has not been evaluated with this Next.js version |
| Vitest | 5.0.1 | Unit tests; configuration in `vitest.config.mts` |
| @types/node | 24.x | Matches the Node runtime; Vitest 5 requires 22 or newer |

- Next.js 16 generates global route types such as `LayoutProps`. `npm run typecheck` runs `next typegen` before `tsc`, as the bundled Next.js CLI documentation recommends.
- This Next.js version ships its documentation in `node_modules/next/dist/docs/`. Read the relevant guide before using Next.js APIs.
- Drizzle, Supabase and the Anthropic SDK are not installed yet. Add each with the feature that uses it.
- npm reported that ESLint 9.39.5 is no longer supported, and that the `unrs-resolver` install script was not run under npm's allow-scripts policy. Lint passes; revisit when eslint-config-next supports a newer ESLint.

## Tradeoffs

Supabase reduces the number of independently integrated services but creates provider dependence in authentication and storage. The core relational data and explicit SQL help maintain a migration path. Integrated services do not eliminate application authorization or make a ledger correct by themselves.

A separate backend could be useful for future long-running processing, but adds deployment/API coordination now. Clerk/Auth.js and Prisma are viable alternatives; they are unnecessary for the current requirements. Drizzle is an engineering preference for explicit SQL, not a claim that Prisma cannot support the app.

## Verified implementation constraints

- Next.js documents Windows support and current installation minimums. Recheck version-specific requirements at setup. [Official installation guide](https://nextjs.org/docs/app/getting-started/installation)
- Use an appropriate PostgreSQL connection strategy. Supabase transaction pooling suits short-lived/serverless workloads; disable prepared statements for that mode, bound per-instance connections, and do not depend on session state surviving across transactions. Use a suitable separate migration connection. [Official connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Validate server identity with the documented claims/user checks. Do not authorize sensitive operations by trusting an unvalidated session object alone. [Official SSR setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
- Storage supports row-level access policies. Service credentials bypass these protections and must remain server-only. A server using privileged access must enforce user permissions explicitly. [Official storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- Drizzle supports explicit transactions/isolation and generated migrations. The eventual ledger still needs application invariants, constraints, retry handling and concurrency tests. [Transactions](https://orm.drizzle.team/docs/transactions), [migrations](https://orm.drizzle.team/docs/migrations)

Do not assume hosted request handlers support indefinitely running jobs or persistent connections. Select that infrastructure only when verification rechecks, asynchronous review or other concrete requirements justify it.

## Not decided by this document

Market mechanics, economy parameters, subject consent, outcome resolution, evidence retention, ranking formula, data schemas and reviewer autonomy remain product choices. The user has accepted public and private evidence categories; they have not approved a particular file-retention policy or external AI processing of that evidence.

No account, paid resource, remote database, upload bucket, deployment or secret has been created. The user must create the Supabase project and Claude API key and place their credentials in `.env.local` themselves.
