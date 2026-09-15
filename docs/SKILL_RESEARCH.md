# Skill research for the social prediction MVP

Verified: 2026-09-15. Status: recommendations only; no skills installed. Product context: all 18 pages of the supplied build specification, through the local text extraction, plus the follow-up broadening goals to friends and OSU students. Next.js and PostgreSQL have now been selected under explicit user delegation; see TECH_STACK.md.

## Recommendation

Yes, specialized skills would improve this build. The strongest additions cover database correctness, React delivery, interface design, and security review. They do not supply the product's verification rules, incentive design, market mathematics, or recommender objectives. Those still require the interviews in the PDF, research, implementation, and validation.

The first three fit the selected web stack. Keep the fourth for an explicit threat-modeling session once a concrete architecture exists. Ranking reflects this project, not general popularity.

| Rank | Skill and exact import folder | Why it fits | Limits and adaptation |
| --- | --- | --- | --- |
| 1 | Supabase: [supabase-postgres-best-practices](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices) | Covers schemas, migrations, query design, row access policies, and concurrent database operations. Particularly useful for private evidence, auditable play-money records, admin permissions, and event data. | Applies to PostgreSQL anywhere; it does not commit us to Supabase hosting. It cannot establish trading invariants, ledger accounting, or settlement correctness for us. Include the folder's reference files when importing. |
| 2 | Vercel: [vercel-react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | Helps keep a mobile feed responsive: efficient data loading, smaller browser bundles, sensible server/client boundaries, and protected server actions. | It is primarily performance guidance, not complete app architecture or security assurance. Apply rules against the selected React/Next.js version. Include `rules/` and `AGENTS.md`. |
| 3 | Anthropic: [frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Useful for the distinctive consumer interface the PDF requests: coherent visual direction, typography, responsive design, clear interaction copy, and visual critique. | It supplies design instructions, not components or application infrastructure. Its strong aesthetic preferences must follow the user's approved design direction. Importing it into Codex does not require using Claude. |
| 4 | OpenAI: [security-threat-model](https://github.com/openai/skills/tree/main/skills/.curated/security-threat-model) | Provides a structured review of trust boundaries and concrete abuse paths around evidence uploads, subject impersonation, admin powers, credentials, and integrity-sensitive state. | It expects repository evidence and an explicit threat-modeling request. It asks targeted context questions before its final report. It does not prove evidence truthful or replace moderation policy, penetration testing, or market-manipulation analysis. Include `references/`. |

Actual instruction files reviewed: [Supabase SKILL.md](https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/SKILL.md), [Vercel SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md), [Anthropic SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), and [OpenAI SKILL.md](https://github.com/openai/skills/blob/main/skills/.curated/security-threat-model/SKILL.md). Recommendations are based on their contents, not merely repository names or installation counts.

## Next.js correction

Do not import the old `next-best-practices` recommendation from `vercel-labs/next-skills`. That repository now says it is no longer a skill: the reference knowledge moved to version-matched Next.js bundled documentation. Its remaining workflow skills moved to `vercel/next.js`. Once the framework version is agreed, use its matching local documentation rather than a frozen copy of the retired skill. [Official migration notice](https://github.com/vercel-labs/next-skills#readme)

## Domain-specific search result

I did not find a sufficiently vetted, directly applicable LMSR or play-money social-market implementation skill to recommend. This is a bounded search result, not a claim that none exists. Searches included `LMSR SKILL.md`, `prediction market SKILL.md design`, and GitHub variants. Many prediction-market results concerned venue trading, arbitrage, crypto settlement, or external oracle integrations, which do not address this MVP's core engineering problem.

A real community [building-recommendation-systems skill](https://github.com/danielmiessler/claude-code-plugins-plus/blob/main/plugins/ai-ml/recommendation-engine/skills/recommendation-engine/SKILL.md) exists; I read its 50-line instruction file. It gives generic advice about Python models, collaborative/content-based filtering, preprocessing, cold starts, and evaluation. I would not prioritize importing it: it does not provide the substantive design treatment this project needs for exposure bias, fair discovery, integrity feedback loops, or a pre-ML MVP. Its model-training orientation is a weak fit for the specification's initial stage.

The [RecSys Factory research paper](https://arxiv.org/html/2608.11241v1) describes an industrial recommender skill ecosystem, but I did not establish an accessible, reusable skill package from the paper. It should not be presented as an importable recommendation.

For market mathematics and discovery design, the better next step is a project-specific research record and explicit tests: pricing and payout invariants, concurrent-trade behavior, cancellation rules, recommender versioning, exposure measurement, and evaluation against the user's chosen objectives. A reusable project skill may become useful after these decisions and conventions exist; creating it now would risk freezing guesses.

## Optional additions and practical compatibility

- [Anthropic webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) is real and includes a Python Playwright workflow and server helper. It could help with later UI verification, but this session already has browser-control tools. It adds runtime dependencies and its examples include Unix paths; a Windows setup needs adaptation. Its blanket `networkidle` waiting advice also needs judgment for a live or polling feed. [Reviewed SKILL.md](https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md)
- [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) is a useful later UI/accessibility review aid. It fetches current external guidelines and names `WebFetch`; Codex can use its available web-fetch capability for that step. It is an audit procedure, not a visual builder. [Reviewed SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)
- Import selected skill directories with their referenced files, rather than a large all-purpose bundle. These Markdown workflows do not require the author's model, but named tools, scripts, paths, framework versions, and trigger conditions still need checking against this environment. Vercel's [skills CLI documentation](https://github.com/vercel-labs/skills/blob/main/README.md) explicitly lists Codex support and specific-skill installation.
- Skills are reusable instructions. Supabase projects, YouTube/GitHub OAuth access, storage accounts, analytics services, and browser automation runtimes are integrations or tools. Importing a skill does not create those resources, authorize account access, verify a person's claims, or supply their credentials.

The existing PDF and browser capabilities are sufficient to continue discovery now. None of these imports needs to block reading, asking the initial product questions, or maintaining project documentation.
