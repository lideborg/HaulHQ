# HaulHQ — Working Conventions

These are the durable rules for working on this repo (apply to humans and to AI agents alike).

## Source control

- **Logical, scoped commits.** A commit should answer one question. If the message wants to be "and / also", split it.
- **Branch naming**: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`. Avoid noun-phrase or question-style names.
- **Don't commit `node_modules/`, build outputs, debug screenshots, or one-off scrape JSON dumps.** The `.gitignore` enforces most of this.

## Review and merge workflow

Every PR — human-authored or AI-authored — goes through this loop **before merge**:

1. **First self-review**: open the PR's diff, read each commit, look for: dead code, premature abstractions, missed edge cases, type-erasing `any`, hardcoded secrets, console.logs, accidentally-committed files, broken imports, unhandled async errors.
2. **Fix anything found.** Push fixes as additional commits, don't force-push (so the review history stays visible).
3. **Second self-review**: re-read the *current* diff (`git diff <base>...HEAD`). Confirm fixes landed and didn't introduce new issues.
4. **Merge** (or hand off — see below).

**Merge authority:**

- **AI may self-merge** routine PRs after passing both reviews: refactors, component ports, doc updates, dependency bumps, tests, scoped feature work that doesn't touch the categories listed below.
- **AI must leave PR for human review** — open as draft, ping the user — when the change touches:
  - **Data shape** (DB schema, JSON file structure used by other tools, public API contracts)
  - **Payments / billing**
  - **Auth** (login flows, permission checks, token handling)
  - **Infra** (Vercel config, environment variables, deployment pipelines, secrets)
- When unsure which bucket applies, default to human review.

## Other conventions

- **Open work-in-progress PRs as drafts.** Mark "Ready for review" only after both self-reviews pass.
- **Branch base** for stacked PRs: explicitly set `--base <prev-branch>` and call out the stack in the PR description.
- **Don't `--force-push`** unless a reviewer asks. Add fix-up commits instead.

## Repo layout

- `data/` — catalog content (JSON files + mirrored images). Source of truth for Phase 1.
- `research/` — markdown notes (sizing, shipping, customs, sellers, scraping playbook).
- `scripts/` — Python helpers for scraping, image download, sizing parse.
- `web/` — legacy static site (vanilla JS). Kept until Next.js port reaches parity, then removed.
- `web-next/` — Next.js 16 + TypeScript + Tailwind app. The future home of the site.

## Code style

- TypeScript: strict mode, no `any` without a `// reason` comment.
- Components live in `web-next/src/components/`. Server vs client split is explicit (`"use client"` directive) and noted in a header comment.
- Pure helpers in `web-next/src/lib/`. If a module is server-only (reads filesystem, uses secrets), it imports `"server-only"`.
- Avoid feature-flag soup. Code that doesn't ship gets deleted, not gated.

## Phase plan (2026-05-04)

- **Phase 1 — Next.js port (current)**: feature-parity with the static site, JSON files still on disk.
- **Phase 2 — Database + agents (later)**: Supabase (Postgres + auth + storage), Drizzle ORM, scraper agents writing into the same DB.
