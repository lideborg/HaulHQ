# HaulHQ — Working Conventions

These are the durable rules for working on this repo (apply to humans and to AI agents alike).

> **AI agents: read this file before any edit, push, or merge.** It supersedes general defaults from your training. If a rule here conflicts with what you'd otherwise do, this file wins.

## Source control

- **Logical, scoped commits.** A commit should answer one question. If the message wants to be "and / also", split it.
- **Branch naming**: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`. Avoid noun-phrase or question-style names.
- **Don't commit `node_modules/`, build outputs, debug screenshots, or one-off scrape JSON dumps.** The `.gitignore` enforces most of this.

## Review and merge workflow

Every PR — human-authored or AI-authored — goes through this loop **before merge**:

1. **First self-review**: open the PR's diff, read each commit, look for: dead code, premature abstractions, missed edge cases, type-erasing `any`, hardcoded secrets, console.logs, accidentally-committed files, broken imports, unhandled async errors.
2. **For UI work, also verify in the browser.** Open the affected page in the Playwright browser MCP, click through the new feature, screenshot, and check the console for errors / warnings. Type checks and lints don't catch hydration mismatches, click-handler bugs, layout regressions, or runtime React warnings — the browser does.
3. **Fix anything found.** Push fixes as additional commits, don't force-push (so the review history stays visible).
4. **Second self-review**: re-read the *current* diff (`git diff <base>...HEAD`). Confirm fixes landed and didn't introduce new issues.
5. **Merge** (or hand off — see below).

**Merge authority:**

- **AI never merges a PR without explicit user approval, full stop.** This applies to docs, refactors, dependencies, schema, infra — everything. The two self-reviews exist to catch issues; the human approval exists to confirm intent.
- After both self-reviews pass, push the PR and **ping the user**. If they reply with a clear go-ahead in chat (e.g. "merge", "looks good", "go ahead"), then merge.
- A `PreToolUse` hook in `.claude/settings.json` enforces this at the tool level: any `gh pr merge` Bash call is blocked unless `ALLOW_AUTO_MERGE=1` is set on that command. To merge after approval, prefix the call: `ALLOW_AUTO_MERGE=1 gh pr merge <id> --merge`.
- If the user wants to keep the PR open while you start the next thing, do that — leave the branch / PR untouched and start a new branch off `main` for the next feature. Don't accumulate uncommitted changes across multiple stacked branches.

## Other conventions

- **Open work-in-progress PRs as drafts.** Mark "Ready for review" only after both self-reviews pass.
- **Branch base** for stacked PRs: explicitly set `--base <prev-branch>` and call out the stack in the PR description.
- **Don't `--force-push`** during review. Add fix-up commits instead so reviewers can see what changed.
  Exception: it's fine to `--force-with-lease` on your own branch when restacking onto an updated base
  (e.g. parent PR was merged) **before** posting any review activity. The rule's purpose is preserving
  review history, not banning rebases.

## Shop catalog (v2 products)

- **Unavailable source → mark `sold_out`, never delete.** Whenever you look up or re-check a product's source link and the listing is gone — Superbuy "no longer available / unable to purchase", Weidian `商品已下架` (off-shelves), Yupoo "This Album Is Not Exist", or any other delisting — set that product's `sold_out = true` in the Supabase `products` table (project ref `pqfiwdscftwhmcutspay`). The shop card then renders "Sold out". Keep the row — it stays visible and re-listable. Only leave a product active/buyable when its buy page still loads with a real price/stock.
- Hero image is `image_urls[0]`; per-image tags live in `image_meta` (`flat_lay/front/worn/detail/size_chart/logo_text/other` + `hero`). Re-tag after any image change with `web-v2/scripts/retag-heroes.mjs --ids <id>`.

## Scraping & image sourcing (rep-fashion links)

Learned the hard way — apply when scraping/re-scraping Superbuy / Taobao / Weidian / Yupoo. (Fuller per-platform mechanics live in the `import-product` skill + agent memory.)

- **Take the hero from the MAIN gallery, not detail crops.** On Superbuy/Taobao the clean product shots are the `/bao/uploaded/` carousel images; `/imgextra/` are close-up detail crops and make terrible thumbnails (this was the root cause of the whole "no clean hero" punch-list). Also drop `_!!0-item_pic`, `-cib`, and `~crop` variants (item badges / cross-store recommendations). Strip `_NxN(qNN)` suffixes for full-res.
- **Superbuy buy pages CAPTCHA once (slide puzzle).** Agents can't / shouldn't solve it — ask the user to slide it in the browser, then the session stays warm for the rest of the batch.
- **Superbuy risk-blocks some brands** (e.g. Gucci-by-Demna) with a "Risk Reminder — legal risks" modal and won't load the item at all. Fall back to the Weidian/Taobao page directly.
- **Weidian `geilicdn` image URLs get false-flagged by the Chrome browser tool's DLP filter** (returned as `[BLOCKED: JWT token]`). The *main-preview* `<img>` always reads clean — click each color swatch to swap the preview and capture that colorway's URL (same trick powers color-splitting). Yupoo needs `Referer = <album URL>` + `/big.jpg`; swatch thumbs are `_30x30q90.jpg` → strip for full-res.
- **Watch for baked-in text.** Seller images with overlaid text ("1981M"), watermarks ("CNMADE"), or dimension labels ("28CM") make poor heroes and confuse the classifier (dimension labels → false `size_chart`). Prefer a clean shot; if none exists, flag for regeneration rather than shipping the noisy one.
- **Price can vary by SIZE, not colorway** (e.g. the Margaux: ¥1450/1700/1950/2200 for sizes 10/12/15/17, identical across finishes). Before flat-pricing a multi-variant listing, click a couple size swatches to check; price each color at the size its hero shows. The live price uses a fullwidth `￥` (U+FFE5).

## Repo layout

- `data/` — catalog content (JSON files + mirrored images). Source of truth for Phase 1.
- `research/` — markdown notes (sizing, shipping, customs, sellers, scraping playbook).
- `scripts/` — Python helpers for scraping, image download, sizing parse.
- `web-next/` — Next.js 16 + TypeScript + Tailwind app.
- `supabase/` — Phase 2 backend: project config + SQL migrations. See `supabase/README.md`.

## Code style

- TypeScript: strict mode, no `any` without a `// reason` comment.
- Components live in `web-next/src/components/`. Server vs client split is explicit (`"use client"` directive) and noted in a header comment.
- Pure helpers in `web-next/src/lib/`. If a module is server-only (reads filesystem, uses secrets), it imports `"server-only"`.
- Avoid feature-flag soup. Code that doesn't ship gets deleted, not gated.

## Phase plan (2026-05-04)

- **Phase 1 — Next.js port (DONE)**: feature-parity with the legacy static site, JSON files still on disk.
- **Phase 2 — Database + agents (in progress)**: Supabase (Postgres + auth + storage), Drizzle ORM, scraper agents writing into the same DB. See `supabase/README.md` for project ref, env vars, and migration conventions.
