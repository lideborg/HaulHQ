# HaulHQ — Working Conventions

These are the durable rules for working on this repo (apply to humans and to AI agents alike).

## Source control

- **Never merge a PR without a code review.** Self-merging is reserved for emergency hotfixes only and must be flagged in the PR description if used.
- **Open PRs as drafts** until they're ready for human review.
- **Self-review before pushing**: read your own diff (`git diff origin/main...HEAD`) and make sure each commit message is meaningful.
- **Logical, scoped commits.** A commit should answer one question. If the message wants to be "and / also", split it.
- **Branch naming**: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`. Avoid noun-phrase or question-style names.
- **Don't commit `node_modules/`, build outputs, debug screenshots, or one-off scrape JSON dumps.** The `.gitignore` enforces most of this.

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
