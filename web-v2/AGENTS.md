<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Shop catalog (products table)

- **Unavailable source → mark `sold_out`, never delete.** Whenever you look up or re-check a product's source link and the listing is gone — Superbuy "no longer available / unable to purchase", Weidian `商品已下架` (off-shelves), Yupoo "This Album Is Not Exist", or any other delisting — set that product's `sold_out = true` (Supabase project ref `pqfiwdscftwhmcutspay`). The shop card then renders "Sold out". Keep the row — it stays visible and re-listable. Only leave a product active/buyable when its buy page still loads with a real price/stock.
- **Hero image is `image_urls[0]`** (grid thumbnail + gallery top). Per-image tags live in `image_meta` (`flat_lay/front/worn/detail/size_chart/logo_text/other` + `hero`). Re-tag after any image change with `scripts/retag-heroes.mjs --ids <id>`.
- **Multi-colorway listings → one product per color** (shared title + " — <Color>", own hero, distinct `source_link` via `#<color-slug>`). `scripts/split-colors.mjs` does this; it and `import-batch.mjs` auto-tag via `retag-heroes.mjs` when `GEMINI_API_KEY` is set.
- Scraping mechanics for getting those images: `research/scraping-playbook.md` + the `import-product` skill.
