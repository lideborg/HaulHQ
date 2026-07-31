# Factories Search + Paste-Link Sourcing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Factories tab where friends search any brand across our 41 curated sellers, get direct deep links into each seller's Yupoo brand category, and paste any product link to add it to their haul with background-sourced title/image/price-note.

**Architecture:** Pure link-classification and HTML-parsing libs (unit-tested) feed a server action that inserts a `sourcing` item instantly and finishes enrichment in `after()` from `next/server`. Factory search joins the existing `sellers` and `seller_brand_links` tables, grouped by Yupoo subdomain (their name columns don't match). A re-runnable crawl script fills brand links for the ~26 uncrawled sellers via Gemini title normalization.

**Tech Stack:** Next.js 16.2.10 App Router (`web-v2/`), Supabase (`createAdminClient`, Storage bucket `product-images`), `node --test`, Gemini 2.5 Flash (crawl script only).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-factories-search-design.md`. Read it first.
- All app code lives in `web-v2/`. Run all npm commands from `web-v2/`.
- **This is NOT the Next.js you know** — check `web-v2/node_modules/next/dist/docs/` before using an unfamiliar API (per `web-v2/AGENTS.md`). `after` from `next/server` is confirmed available.
- Friend nav order (exact): **Shop · Factories · Profile · Haul**.
- Page copy must NOT name Yupoo — say "a separate site".
- Seller display names: first letter capitalized ("deateath" → "Deateath"; "99team" stays "99team").
- NO auto-markup on scraped prices. Scraped price goes to `items.admin_note` only.
- An item must never be left in `status = "sourcing"` by the resolver — the finally-block always transitions it to `"requested"`.
- New DB status value `"sourcing"` on `items.status` — no schema migration needed (text column).
- No em dashes in user-facing copy or commit messages.
- Test runner: `npm test` = `node --test "src/lib/**/*.test.*" "scripts/lib/**/*.test.*"`.
- Commit after every task with the trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Link classifier (`sourceLink.ts`)

**Files:**
- Create: `web-v2/src/lib/sourceLink.ts`
- Test: `web-v2/src/lib/sourceLink.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `type SourceKind = "yupoo_album" | "yupoo_shop" | "weidian" | "taobao"`
  - `interface SourceLink { kind: SourceKind; url: string; itemId: string | null; shop: string | null }`
  - `classifySourceLink(raw: string): SourceLink | null`
  - `superbuyWrap(url: string): string`
  - `yupooSubdomain(url: string | null): string | null`

- [ ] **Step 1: Write the failing test**

Create `web-v2/src/lib/sourceLink.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySourceLink, superbuyWrap, yupooSubdomain } from "./sourceLink";

test("yupoo album link", () => {
  const r = classifySourceLink("https://99team.x.yupoo.com/albums/196799387?uid=1&isSubCate=false");
  assert.equal(r?.kind, "yupoo_album");
  assert.equal(r?.itemId, "196799387");
  assert.equal(r?.shop, "99team");
});

test("yupoo shop / category link", () => {
  const r = classifySourceLink("https://deateath.x.yupoo.com/categories/4568344");
  assert.equal(r?.kind, "yupoo_shop");
  assert.equal(r?.shop, "deateath");
  assert.equal(r?.itemId, null);
});

test("weidian item link", () => {
  const r = classifySourceLink("https://weidian.com/item.html?itemID=7405328504&spider_token=4a2c");
  assert.equal(r?.kind, "weidian");
  assert.equal(r?.itemId, "7405328504");
});

test("taobao item link", () => {
  const r = classifySourceLink("https://item.taobao.com/item.htm?id=929261115961&ali_trackid=x");
  assert.equal(r?.kind, "taobao");
  assert.equal(r?.itemId, "929261115961");
});

test("superbuy wrapper unwraps to the inner link", () => {
  const inner = "https://weidian.com/item.html?itemID=7405328504";
  const r = classifySourceLink(`https://www.superbuy.com/en/page/buy/?from=search-input&url=${encodeURIComponent(inner)}`);
  assert.equal(r?.kind, "weidian");
  assert.equal(r?.itemId, "7405328504");
  assert.equal(r?.url, inner);
});

test("junk is rejected", () => {
  assert.equal(classifySourceLink("not a url"), null);
  assert.equal(classifySourceLink("https://google.com/whatever"), null);
  assert.equal(classifySourceLink("ftp://weidian.com/item.html?itemID=1"), null);
  assert.equal(classifySourceLink("https://www.superbuy.com/en/page/buy/"), null);
});

test("superbuyWrap builds the buy-page wrapper", () => {
  assert.equal(
    superbuyWrap("https://weidian.com/item.html?itemID=1"),
    "https://www.superbuy.com/en/page/buy/?from=search-input&url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D1",
  );
});

test("yupooSubdomain", () => {
  assert.equal(yupooSubdomain("https://mvt-shop01.x.yupoo.com/albums"), "mvt-shop01");
  assert.equal(yupooSubdomain("https://deateath.x.yupoo.com/"), "deateath");
  assert.equal(yupooSubdomain("https://weidian.com/item.html?itemID=1"), null);
  assert.equal(yupooSubdomain(null), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web-v2/`): `npm test`
Expected: FAIL — `Cannot find module './sourceLink'`.

- [ ] **Step 3: Write the implementation**

Create `web-v2/src/lib/sourceLink.ts`:

```ts
// Classify a pasted product link. Pure — no framework imports, unit-tested.
// Superbuy "buy page" wrappers are unwrapped to the underlying store link so
// we always persist the canonical source (spec §4.1).
export type SourceKind = "yupoo_album" | "yupoo_shop" | "weidian" | "taobao";

export interface SourceLink {
  kind: SourceKind;
  url: string; // canonical (unwrapped) link
  itemId: string | null;
  shop: string | null; // yupoo subdomain, when applicable
}

export function classifySourceLink(raw: string): SourceLink | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  if (/(^|\.)superbuy\.com$/i.test(u.hostname)) {
    const inner = u.searchParams.get("url");
    return inner ? classifySourceLink(inner) : null;
  }

  const yupoo = u.hostname.match(/^([a-z0-9-]+)\.x\.yupoo\.com$/i);
  if (yupoo) {
    const shop = yupoo[1].toLowerCase();
    const album = u.pathname.match(/^\/albums\/(\d+)/);
    if (album)
      return { kind: "yupoo_album", url: u.toString(), itemId: album[1], shop };
    return { kind: "yupoo_shop", url: u.toString(), itemId: null, shop };
  }

  if (/(^|\.)weidian\.com$/i.test(u.hostname)) {
    const itemId =
      u.searchParams.get("itemID") ??
      u.searchParams.get("itemId") ??
      u.searchParams.get("id");
    return { kind: "weidian", url: u.toString(), itemId, shop: null };
  }

  if (/(^|\.)(taobao|tmall)\.com$/i.test(u.hostname)) {
    return { kind: "taobao", url: u.toString(), itemId: u.searchParams.get("id"), shop: null };
  }

  return null;
}

// Admin builds this on the fly for weidian/taobao sources — never stored.
export function superbuyWrap(url: string): string {
  return `https://www.superbuy.com/en/page/buy/?from=search-input&url=${encodeURIComponent(url)}`;
}

export function yupooSubdomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const m = new URL(url).hostname.match(/^([a-z0-9-]+)\.x\.yupoo\.com$/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all new tests; the pre-existing 29 sizing tests stay green).

- [ ] **Step 5: Commit**

```bash
git add web-v2/src/lib/sourceLink.ts web-v2/src/lib/sourceLink.test.ts
git commit -m "feat(v2): classify pasted source links (yupoo/weidian/taobao/superbuy)"
```

---

### Task 2: Source-page parsers (`sourceParse.ts`)

**Files:**
- Create: `web-v2/src/lib/sourceParse.ts`
- Test: `web-v2/src/lib/sourceParse.test.ts`

**Interfaces:**
- Consumes: nothing (pure — takes HTML strings).
- Produces:
  - `interface ParsedSource { title: string | null; imageUrl: string | null; priceCny: number | null }`
  - `parseYupooAlbum(html: string): ParsedSource`
  - `parseWeidianItem(html: string): ParsedSource`

- [ ] **Step 1: Write the failing test**

Create `web-v2/src/lib/sourceParse.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYupooAlbum, parseWeidianItem } from "./sourceParse";

const YUPOO_HTML = `<!doctype html><html><head>
<meta property="og:title" content="TR* 24ss suede loafers ¥560 | Yupoo">
<meta property="og:image" content="//photo.yupoo.com/99team/abc123/big.jpg">
<title>TR* 24ss suede loafers ¥560 | Yupoo</title>
</head><body></body></html>`;

test("yupoo: title from og:title, pipe-suffix stripped, price from ¥", () => {
  const r = parseYupooAlbum(YUPOO_HTML);
  assert.equal(r.title, "TR* 24ss suede loafers ¥560");
  assert.equal(r.imageUrl, "https://photo.yupoo.com/99team/abc123/big.jpg");
  assert.equal(r.priceCny, 560);
});

test("yupoo: falls back to <title>, null price when absent", () => {
  const html = `<html><head><title>Plain album | Yupoo</title></head></html>`;
  const r = parseYupooAlbum(html);
  assert.equal(r.title, "Plain album");
  assert.equal(r.imageUrl, null);
  assert.equal(r.priceCny, null);
});

const WEIDIAN_HTML = `<html><head>
<meta name="og:title" content="The Row 平底穆勒鞋">
</head><body><script>window.__DATA={"itemMainPic":"//img.weidian.com/x/y.jpg","price":"268.00"}</script></body></html>`;

test("weidian: title, protocol-relative image, embedded price", () => {
  const r = parseWeidianItem(WEIDIAN_HTML);
  assert.equal(r.title, "The Row 平底穆勒鞋");
  assert.equal(r.imageUrl, "https://img.weidian.com/x/y.jpg");
  assert.equal(r.priceCny, 268);
});

test("weidian: all-null on unparseable html", () => {
  const r = parseWeidianItem("<html><body>captcha</body></html>");
  assert.deepEqual(r, { title: null, imageUrl: null, priceCny: null });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './sourceParse'`.

- [ ] **Step 3: Write the implementation**

Create `web-v2/src/lib/sourceParse.ts`:

```ts
// Best-effort extraction from fetched store pages. Pure string parsing —
// regex over HTML is deliberate (no DOM dependency, page shapes are simple
// meta tags / embedded JSON). Every field is nullable; callers treat null
// as "leave it for the admin".
export interface ParsedSource {
  title: string | null;
  imageUrl: string | null;
  priceCny: number | null;
}

function metaContent(html: string, prop: string): string | null {
  const a = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
    "i",
  ).exec(html);
  if (a) return a[1] || null;
  const b = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  ).exec(html);
  return b ? b[1] || null : null;
}

function absolutize(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

function priceFromText(text: string): number | null {
  const m = text.match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function parseYupooAlbum(html: string): ParsedSource {
  let title = metaContent(html, "og:title") ?? /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? null;
  if (title) title = title.replace(/\s*\|[^|]*$/, "").trim() || null;
  let imageUrl = metaContent(html, "og:image");
  if (!imageUrl) {
    imageUrl = /(?:https?:)?\/\/photo\.yupoo\.com\/[^"'\s]+/i.exec(html)?.[0] ?? null;
  }
  return {
    title,
    imageUrl: absolutize(imageUrl),
    priceCny: title ? priceFromText(title) : null,
  };
}

export function parseWeidianItem(html: string): ParsedSource {
  const title =
    metaContent(html, "og:title") ??
    /"itemName"\s*:\s*"([^"]+)"/.exec(html)?.[1] ??
    null;
  const imageUrl =
    metaContent(html, "og:image") ??
    /"itemMainPic"\s*:\s*"([^"]+)"/.exec(html)?.[1] ??
    null;
  const price = /"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/.exec(html);
  return {
    title: title?.trim() || null,
    imageUrl: absolutize(imageUrl),
    priceCny: price ? parseFloat(price[1]) : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-v2/src/lib/sourceParse.ts web-v2/src/lib/sourceParse.test.ts
git commit -m "feat(v2): parse yupoo/weidian pages for title, image, listed price"
```

---

### Task 3: Factory grouping + data layer

**Files:**
- Create: `web-v2/src/lib/factories.ts`
- Test: `web-v2/src/lib/factories.test.ts`
- Modify: `web-v2/src/lib/data.ts` (append one function at the end)

**Interfaces:**
- Consumes: `yupooSubdomain` from Task 1; `Seller` from `web-v2/src/lib/types.ts` (`{ id, name, brands: string[], yupoo_url: string | null, superbuy_store: string | null, notes }`); `SellerBrandLink` from `data.ts` (`{ seller: string; brand: string; alias: string | null; url: string }`); existing `getSellerBrandLinks(search)` and private `searchTerm()` already in `data.ts`.
- Produces:
  - `interface FactoryLink { brand: string; alias: string | null; url: string }`
  - `interface FactoryCard { displayName: string; yupooUrl: string | null; brands: string[]; links: FactoryLink[] }`
  - `displaySellerName(name: string): string`
  - `groupFactories(sellers, links, term): FactoryCard[]` (pure)
  - `getFactories(q?: string | null): Promise<FactoryCard[]>` in `data.ts`

**Context you must know:** `seller_brand_links.seller` holds strings like `"mvt-shop01 (Yupoo)"` while `sellers.name` holds `"MVT"` — they do NOT join by name. Both sides have a Yupoo URL, so grouping is by `yupooSubdomain(url)`.

- [ ] **Step 1: Write the failing test**

Create `web-v2/src/lib/factories.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { displaySellerName, groupFactories } from "./factories";
import type { Seller } from "./types";

const seller = (name: string, brands: string[], yupoo: string | null): Seller => ({
  id: name,
  name,
  brands,
  yupoo_url: yupoo,
  superbuy_store: null,
  notes: null,
});

const SELLERS = [
  seller("MVT", ["Supreme", "Gucci"], "https://mvt-shop01.x.yupoo.com/albums"),
  seller("deateath", ["Our Legacy", "Prada"], "https://deateath.x.yupoo.com/"),
  seller("Frank Chang", ["The Row"], null),
];

const LINKS = [
  { seller: "deateath (Yupoo)", brand: "Prada", alias: "P⭐A⭐A", url: "https://deateath.x.yupoo.com/categories/4568344" },
  { seller: "yolo66 (Yupoo)", brand: "Prada", alias: null, url: "https://yolo66.x.yupoo.com/categories/111" },
];

test("first letter capitalized, digits untouched", () => {
  assert.equal(displaySellerName("deateath"), "Deateath");
  assert.equal(displaySellerName("99team"), "99team");
  assert.equal(displaySellerName("MVT"), "MVT");
});

test("no search term: every seller gets a card, no links", () => {
  const cards = groupFactories(SELLERS, [], "");
  assert.equal(cards.length, 3);
  assert.ok(cards.every((c) => c.links.length === 0));
});

test("search groups links onto sellers by yupoo subdomain", () => {
  const cards = groupFactories(SELLERS, LINKS, "prada");
  const deateath = cards.find((c) => c.displayName === "Deateath");
  assert.equal(deateath?.links.length, 1);
  assert.equal(deateath?.links[0].brand, "Prada");
});

test("search filters to matching sellers; link-only shops get synthetic cards", () => {
  const cards = groupFactories(SELLERS, LINKS, "prada");
  // deateath (brands + link), yolo66 (link-only, not in sellers table)
  assert.deepEqual(
    cards.map((c) => c.displayName).sort(),
    ["Deateath", "Yolo66"],
  );
  const yolo = cards.find((c) => c.displayName === "Yolo66");
  assert.equal(yolo?.yupooUrl, "https://yolo66.x.yupoo.com");
});

test("brands-array match works without any brand link", () => {
  const cards = groupFactories(SELLERS, [], "supreme");
  assert.deepEqual(cards.map((c) => c.displayName), ["MVT"]);
});

test("cards with direct links sort before brands-only matches", () => {
  const cards = groupFactories(SELLERS, LINKS, "prada");
  assert.equal(cards[0].links.length > 0, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './factories'`.

- [ ] **Step 3: Write the implementation**

Create `web-v2/src/lib/factories.ts`:

```ts
// Pure grouping for the Factories page. sellers.name and seller_brand_links
// .seller use different naming conventions, so the join key is the Yupoo
// subdomain on each side's URL.
import { yupooSubdomain } from "./sourceLink";
import type { Seller } from "./types";

export interface FactoryLink {
  brand: string;
  alias: string | null;
  url: string;
}

export interface FactoryCard {
  displayName: string;
  yupooUrl: string | null;
  brands: string[];
  links: FactoryLink[];
}

export function displaySellerName(name: string): string {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

export function groupFactories(
  sellers: Seller[],
  links: Array<{ brand: string; alias: string | null; url: string }>,
  term: string,
): FactoryCard[] {
  const q = term.trim().toLowerCase();
  const bySub = new Map<string, FactoryLink[]>();
  for (const l of links) {
    const sub = yupooSubdomain(l.url);
    if (!sub) continue;
    const list = bySub.get(sub) ?? [];
    list.push({ brand: l.brand, alias: l.alias, url: l.url });
    bySub.set(sub, list);
  }

  const cards: FactoryCard[] = [];
  const claimed = new Set<string>();
  for (const s of sellers) {
    const sub = yupooSubdomain(s.yupoo_url);
    const myLinks = (sub ? bySub.get(sub) : undefined) ?? [];
    if (sub) claimed.add(sub);
    const brandHit = q !== "" && s.brands.some((b) => b.toLowerCase().includes(q));
    if (q === "" || brandHit || myLinks.length > 0) {
      cards.push({
        displayName: displaySellerName(s.name),
        yupooUrl: s.yupoo_url,
        brands: s.brands,
        links: myLinks,
      });
    }
  }
  // Crawled shops we never added to `sellers` still deserve a card on search.
  for (const [sub, subLinks] of bySub) {
    if (claimed.has(sub)) continue;
    cards.push({
      displayName: displaySellerName(sub),
      yupooUrl: `https://${sub}.x.yupoo.com`,
      brands: [],
      links: subLinks,
    });
  }

  cards.sort(
    (a, b) =>
      (b.links.length > 0 ? 1 : 0) - (a.links.length > 0 ? 1 : 0) ||
      a.displayName.localeCompare(b.displayName),
  );
  return cards;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add `getFactories` to the data layer**

Append at the end of `web-v2/src/lib/data.ts` (it already imports `createAdminClient` and defines `searchTerm` + `getSellerBrandLinks` near the top; add the two new imports to the existing import block at the top of the file):

```ts
import { groupFactories, type FactoryCard } from "./factories";
```

```ts
// Factories page: all curated sellers, plus (when searching) direct brand
// category links grouped onto them by Yupoo subdomain.
export async function getFactories(q?: string | null): Promise<FactoryCard[]> {
  const term = searchTerm(q ?? "");
  const sb = createAdminClient();
  const [{ data: sellers, error }, links] = await Promise.all([
    sb.from("sellers").select("*").order("name"),
    term ? getSellerBrandLinks(term) : Promise.resolve([]),
  ]);
  if (error) throw error;
  return groupFactories((sellers ?? []) as Seller[], links, term);
}
```

Check first how `searchTerm` is defined in `data.ts` (around line 49's usage) and match its signature; if it lowercases/escapes, pass the raw `q` into `groupFactories` the same way `getSellerBrandLinks` receives it, i.e. `groupFactories(..., links, (q ?? "").trim())`.

- [ ] **Step 6: Typecheck + full tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add web-v2/src/lib/factories.ts web-v2/src/lib/factories.test.ts web-v2/src/lib/data.ts
git commit -m "feat(v2): factory card grouping + getFactories data helper"
```

---

### Task 4: Factories page UI, nav, and shop hint

**Files:**
- Create: `web-v2/src/app/[handle]/factories/page.tsx`
- Modify: `web-v2/src/components/FriendHeader.tsx` (nav order)
- Modify: `web-v2/src/app/[handle]/shop/page.tsx` (hint line + stale request-page copy)
- Modify: `web-v2/src/components/UsernameForm.tsx:7-8` (stale comment cleanup, carried over from last PR)

**Interfaces:**
- Consumes: `getFactories(q)` from Task 3; `addLinkToHaul(handle, formData)` from Task 5 — at this task's commit point the form posts to a stub action created here and fleshed out in Task 5.
- Produces: route `/[handle]/factories` (auth comes free from `web-v2/src/app/[handle]/layout.tsx`, which already gates on own-or-admin and renders `FriendHeader`).

- [ ] **Step 1: Nav order in `FriendHeader.tsx`**

Replace the `<nav>` links block so the order is Shop, Factories, Profile, Haul:

```tsx
<nav className="flex gap-6 text-[11px] uppercase tracking-widest text-neutral-500">
  <Link href={`/${handle}/shop`} className="hover:text-black">
    Shop
  </Link>
  <Link href={`/${handle}/factories`} className="hover:text-black">
    Factories
  </Link>
  <Link href={`/${handle}/profile`} className="hover:text-black">
    Profile
  </Link>
  <Link href={`/${handle}/haul`} className="hover:text-black">
    Haul{haulCount > 0 ? ` (${haulCount})` : ""}
  </Link>
</nav>
```

- [ ] **Step 2: Create the stub action file**

Create `web-v2/src/app/[handle]/factories/actions.ts` (Task 5 replaces the body):

```ts
"use server";

import { redirect } from "next/navigation";

export async function addLinkToHaul(handle: string, formData: FormData) {
  void formData;
  redirect(`/${handle}/factories?error=link`);
}
```

- [ ] **Step 3: Create the page**

Create `web-v2/src/app/[handle]/factories/page.tsx`. Match the site's visual language (see `shop/page.tsx`, `haul/page.tsx`: `text-[11px] uppercase tracking-widest`, thin neutral borders, no rounded corners). Approved copy verbatim; do not name Yupoo:

```tsx
import { getFactories } from "@/lib/data";
import { addLinkToHaul } from "./actions";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function FactoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const added = one(sp.added) === "1";
  const error = one(sp.error);
  const cards = await getFactories(q);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Factories</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
        These factories and sellers have been curated. Most we have researched
        or ordered from. Looking for a brand that is not in the shop? Search it
        here and we will show you which factories carry it. They open in a
        separate site. Browse, and when you find something you like, paste the
        link below and it is added to your haul. You can remove it any time.
      </p>

      <form method="get" className="mt-8">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search any brand, e.g. Prada"
          className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </form>

      <div className="mt-4 border border-neutral-200 p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest">
          Found something? Add it to your haul
        </p>
        <form action={addLinkToHaul.bind(null, handle)} className="flex gap-2">
          <input
            type="url"
            name="link"
            required
            placeholder="Paste the product link"
            className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <button className="whitespace-nowrap border border-black px-4 py-2 text-[10px] uppercase tracking-widest transition hover:bg-black hover:text-white">
            Add product
          </button>
        </form>
        {added && (
          <p className="mt-2 text-xs text-neutral-600">
            Added to your haul. We are finding the details in the background.
          </p>
        )}
        {error === "link" && (
          <p className="mt-2 text-xs text-red-600">
            That does not look like a product link from one of our sellers.
            Paste the product page link.
          </p>
        )}
        {error === "save" && (
          <p className="mt-2 text-xs text-red-600">
            Could not save that just now. Try again in a moment.
          </p>
        )}
      </div>

      <p className="mt-8 text-[11px] uppercase tracking-widest text-neutral-500">
        {q ? `“${q}” · ${cards.length} factories` : `${cards.length} factories`}
      </p>
      {cards.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No factory matches that brand yet. Paste a link above and Admin will
          source it anyway.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.displayName} className="border border-neutral-200 p-4">
              <p className="text-sm font-semibold">{c.displayName}</p>
              {c.brands.length > 0 && (
                <p className="mt-1 text-xs text-neutral-500">
                  {c.brands.slice(0, 6).join(" · ")}
                  {c.brands.length > 6 ? ` · +${c.brands.length - 6} more` : ""}
                </p>
              )}
              <div className="mt-3 space-y-1">
                {c.links.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs underline hover:text-neutral-500"
                  >
                    {l.brand} at {c.displayName} →
                  </a>
                ))}
                {c.links.length === 0 && c.yupooUrl && (
                  <a
                    href={c.yupooUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs underline hover:text-neutral-500"
                  >
                    Visit their shop →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Shop page hint**

In `web-v2/src/app/[handle]/shop/page.tsx`:

a) Inside the `sellerLinks.length > 0` block, replace the stale closing hint (`Found something? Paste the link on the Request page and Admin will price it.`) with:

```tsx
<p className="mt-2 text-[10px] text-neutral-400">
  Found something? Paste the link on the Factories page and it goes
  straight into your haul.
</p>
```

b) Directly after that whole `sellerLinks.length > 0 && (...)` block, add an always-on-search hint (needs `import Link from "next/link";` at the top):

```tsx
{q && (
  <p className="mt-6 text-xs text-neutral-500">
    Can&rsquo;t find it?{" "}
    <Link
      href={`/${handle}/factories?q=${encodeURIComponent(q)}`}
      className="underline hover:text-black"
    >
      Search our factories →
    </Link>
  </p>
)}
```

- [ ] **Step 5: Stale comment cleanup**

In `web-v2/src/components/UsernameForm.tsx`, replace lines 7-8:

```ts
// A friend's handle is their login and their public link, so renames are
// gated behind a confirm() prompt — no accidental or constant changes.
```

with:

```ts
// A friend's handle is their login and their public link — renaming updates
// every URL, so the server re-checks format, reservations, and uniqueness.
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean. Then `npm run dev`, open `http://localhost:3000/hampus/factories` (admin session or hampus login required): grid of ~41 factories renders; searching `prada` shows cards with direct links first; nav reads Shop · Factories · Profile · Haul.

- [ ] **Step 7: Commit**

```bash
git add web-v2/src/app/\[handle\]/factories web-v2/src/components/FriendHeader.tsx web-v2/src/app/\[handle\]/shop/page.tsx web-v2/src/components/UsernameForm.tsx
git commit -m "feat(v2): factories tab with brand search, factory cards, add box"
```

---

### Task 5: Add-to-haul action + background resolver + haul rendering

**Files:**
- Create: `web-v2/src/lib/sourcing.ts`
- Modify: `web-v2/src/app/[handle]/factories/actions.ts` (replace stub)
- Modify: `web-v2/src/app/[handle]/haul/page.tsx` (sourcing state)

**Interfaces:**
- Consumes: `classifySourceLink` (Task 1), `parseYupooAlbum` / `parseWeidianItem` (Task 2), `createAdminClient` from `@/lib/supabase/admin`, `getCurrentFriend` from `@/lib/friend`, `after` from `next/server`.
- Produces: `resolveSourcingItem(itemId: string): Promise<void>`; final `addLinkToHaul(handle: string, formData: FormData)`.

**Pattern to copy:** `submitRequest` in `web-v2/src/app/request/actions.ts` (items insert → notifications insert → status_events insert). Storage upload pattern: `scripts/lib/storage.mjs` (`sb.storage.from("product-images").upload(key, buf, { contentType, upsert: true })`, public URL = `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${key}`).

- [ ] **Step 1: Create the resolver**

Create `web-v2/src/lib/sourcing.ts`:

```ts
// Background enrichment for friend-pasted links. Best-effort by design: any
// failure (blocked fetch, weird markup, storage error) must still land the
// item as a plain "requested" link — the admin inbox is the guarantee.
import { createAdminClient } from "@/lib/supabase/admin";
import { classifySourceLink } from "./sourceLink";
import { parseYupooAlbum, parseWeidianItem, type ParsedSource } from "./sourceParse";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CNY_PER_USD = 7.2;

export async function resolveSourcingItem(itemId: string): Promise<void> {
  const sb = createAdminClient();
  const patch: Record<string, unknown> = {};
  try {
    const { data: item } = await sb
      .from("items")
      .select("id, source_link")
      .eq("id", itemId)
      .single();
    const src = item?.source_link ? classifySourceLink(item.source_link) : null;
    if (src) {
      const res = await fetch(src.url, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const html = await res.text();
        const parsed: ParsedSource =
          src.kind === "weidian" || src.kind === "taobao"
            ? parseWeidianItem(html)
            : parseYupooAlbum(html);
        if (parsed.title) patch.title = parsed.title.slice(0, 200);
        if (parsed.imageUrl) {
          const stored = await mirrorItemImage(
            sb,
            itemId,
            parsed.imageUrl,
            src.kind.startsWith("yupoo"),
          );
          if (stored) patch.image_urls = [stored];
        }
        if (parsed.priceCny != null) {
          patch.admin_note = `listed ¥${parsed.priceCny} ≈ $${Math.round(parsed.priceCny / CNY_PER_USD)}`;
        }
      }
    }
  } catch {
    // fall through — the finally below still files the request
  } finally {
    // .eq status guard: never clobber an item the admin already moved on.
    await sb
      .from("items")
      .update({ ...patch, status: "requested" })
      .eq("id", itemId)
      .eq("status", "sourcing");
  }
}

async function mirrorItemImage(
  sb: ReturnType<typeof createAdminClient>,
  itemId: string,
  imageUrl: string,
  isYupoo: boolean,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = { "user-agent": UA };
    if (isYupoo) headers.referer = "https://x.yupoo.com/";
    const res = await fetch(imageUrl, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5_000) return null; // anti-hotlink placeholder, not a photo
    const key = `items/${itemId}/000.jpg`;
    const { error } = await sb.storage.from("product-images").upload(key, buf, {
      contentType: res.headers.get("content-type") ?? "image/jpeg",
      upsert: true,
    });
    if (error) return null;
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${key}`;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Replace the stub action**

Replace the whole of `web-v2/src/app/[handle]/factories/actions.ts`:

```ts
"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";
import { classifySourceLink } from "@/lib/sourceLink";
import { resolveSourcingItem } from "@/lib/sourcing";

// Instant insert, background enrichment (spec §4). The item shows up in the
// haul as "sourcing" before the response even lands; after() finishes the
// title/image/price lookup once the redirect has been sent.
export async function addLinkToHaul(handle: string, formData: FormData) {
  const raw = String(formData.get("link") ?? "").trim();
  const src = classifySourceLink(raw);
  if (!src) redirect(`/${handle}/factories?error=link`);

  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) redirect("/login");

  const sb = createAdminClient();
  const { data: item, error } = await sb
    .from("items")
    .insert({
      owner_id: friend.id,
      source_link: src.url,
      status: "sourcing",
    })
    .select("id")
    .single();
  if (error) redirect(`/${handle}/factories?error=save`);

  await sb.from("notifications").insert({
    kind: "new_request",
    item_id: item.id,
    friend_id: friend.id,
    payload: { link: src.url, friend: friend.name, via: "factories" },
  });
  await sb.from("status_events").insert({
    item_id: item.id,
    status: "sourcing",
    note: "Link added from Factories",
  });

  after(() => resolveSourcingItem(item.id));

  revalidatePath(`/${handle}/haul`);
  redirect(`/${handle}/factories?added=1`);
}
```

Note: `redirect()` throws, so TypeScript narrows `src`/`friend`/`item` correctly after each guard. If tsc complains about `item` being possibly null after the error guard, use `if (error || !item) redirect(...)`.

- [ ] **Step 3: Haul page sourcing state**

In `web-v2/src/app/[handle]/haul/page.tsx`, inside `items.map`, add after the `img` const:

```tsx
const sourcing = item.status === "sourcing";
const linkHost = (() => {
  try {
    return item.source_link ? new URL(item.source_link).hostname : null;
  } catch {
    return null;
  }
})();
```

Change the `name` fallback line to:

```tsx
const name =
  item.products?.display_title ?? item.title ?? linkHost ?? "Untitled";
```

Change the size/weight line to show the sourcing state:

```tsx
<p className="mt-0.5 text-[11px] text-neutral-500">
  {sourcing
    ? "Finding the details…"
    : `${item.chosen_size ? `Size ${item.chosen_size}` : "No size"} · ~${grams(item.products?.weight_g)}`}
</p>
```

Change the price cell to:

```tsx
<p className="text-sm tabular-nums">
  {item.quoted_price_usd != null
    ? usd(item.quoted_price_usd)
    : sourcing
      ? "Price coming"
      : "Quote"}
</p>
```

(The template-literal size/weight line drops the JSX `{" · "}` pieces; keep output identical for non-sourcing items.)

- [ ] **Step 4: Verify end to end locally**

Run: `npx tsc --noEmit && npm run lint && npm test` — clean.

Then with `npm run dev` and a logged-in friend session, paste
`https://99team.x.yupoo.com/albums/196799387?uid=1` (any live album from the shop's sellers works — grab one from `select url from seller_brand_links limit 5` if needed) into the Factories add box:
- Redirects to `?added=1` with the confirmation line.
- `/hampus/haul` immediately shows the item with "Finding the details…" and "Price coming".
- Within ~15s (refresh), title + image appear and status flips to requested (`select status, title, image_urls, admin_note from items order by created_at desc limit 1`).
- Paste junk (`https://google.com`) → `?error=link` message, no item created.

- [ ] **Step 5: Commit**

```bash
git add web-v2/src/lib/sourcing.ts web-v2/src/app/\[handle\]/factories/actions.ts web-v2/src/app/\[handle\]/haul/page.tsx
git commit -m "feat(v2): paste-link add to haul with background sourcing"
```

---

### Task 6: Admin inbox shows sourcing items + Superbuy wrapper

**Files:**
- Modify: `web-v2/src/app/admin/inbox/page.tsx`

**Interfaces:**
- Consumes: `classifySourceLink`, `superbuyWrap` from Task 1.

- [ ] **Step 1: Include sourcing items in the query**

In `web-v2/src/app/admin/inbox/page.tsx`, change the items query from `.eq("status", "requested")` to:

```ts
.in("status", ["requested", "sourcing"])
```

This guarantees an item is never invisible even if a background task dies before its finally-block runs (process kill).

- [ ] **Step 2: Per-item sourcing badge + Superbuy link**

Add imports at the top:

```ts
import { classifySourceLink, superbuyWrap } from "@/lib/sourceLink";
```

Inside `items.map`, before the `return`, add:

```ts
const src = item.source_link ? classifySourceLink(item.source_link) : null;
const superbuy =
  src && (src.kind === "weidian" || src.kind === "taobao")
    ? superbuyWrap(src.url)
    : null;
```

In the friend/date meta line, append a badge for in-flight items:

```tsx
{item.status === "sourcing" ? " · sourcing…" : ""}
```

After the size/notes line (`{item.chosen_size ? ... }` paragraph), add:

```tsx
{(item.admin_note || superbuy) && (
  <p className="mt-1 text-[11px] text-neutral-500">
    {item.admin_note}
    {item.admin_note && superbuy ? " · " : ""}
    {superbuy && (
      <a
        href={superbuy}
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-black"
      >
        Open in Superbuy →
      </a>
    )}
  </p>
)}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. With the dev server: `/admin/inbox` shows the Task 5 test item with its scraped `admin_note`; add a Weidian item (`https://weidian.com/item.html?itemID=7405328504`) via Factories and confirm the inbox row shows "Open in Superbuy →" pointing at the wrapped URL.

- [ ] **Step 4: Commit**

```bash
git add web-v2/src/app/admin/inbox/page.tsx
git commit -m "feat(v2): inbox shows sourcing items, scraped price note, superbuy link"
```

---

### Task 7: Category crawl script (fills the other ~26 sellers)

**Files:**
- Create: `web-v2/scripts/lib/yupoo-categories.mjs`
- Test: `web-v2/scripts/lib/yupoo-categories.test.mjs`
- Create: `web-v2/scripts/crawl-seller-categories.mjs`

**Interfaces:**
- Consumes: `loadEnv` from `web-v2/scripts/lib/env.mjs`, `adminClient` from `web-v2/scripts/lib/storage.mjs`, `GEMINI_API_KEY` env var. Gemini call pattern: copy `gemini()` from `web-v2/scripts/propose-display-titles.mjs:38-52` (model `gemini-2.5-flash`, `generationConfig.responseSchema`, 429/5xx retry loop).
- Produces: `parseCategories(html): Array<{ id: string; title: string }>`; runnable `node scripts/crawl-seller-categories.mjs [--dry] [--only <subdomain>]`.

**Context:** Yupoo category anchors look like `<a href='https://<shop>.x.yupoo.com/categories/5225748' title='👜The Row'>...` — single-quoted attributes, HTML entities (`&amp;`, `&#x27;`), and two junk entries to skip: the "all" link (no numeric id) and category `0` ("other"/未分类相册). `seller_brand_links` rows use `seller = "<subdomain> (Yupoo)"`, `alias` = raw category title, `url = "https://<subdomain>.x.yupoo.com/categories/<id>"`, `active = true`.

- [ ] **Step 1: Write the failing parser test**

Create `web-v2/scripts/lib/yupoo-categories.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCategories } from "./yupoo-categories.mjs";

const HTML = `
<a href='https://99team.x.yupoo.com/categories/' title='全部分类'>全部分类</a>
<a href='https://99team.x.yupoo.com/categories/0' title='other'>未分类相册</a>
<a href='https://99team.x.yupoo.com/categories/5225737' title='👜D&amp;G'>👜D&amp;G</a>
<a href='https://99team.x.yupoo.com/categories/5225748' title='👜The Row'>👜The Row</a>
<a href="https://x.x.yupoo.com/categories/123" title="Men&#x27;s Shoes">dup below</a>
<a href="https://x.x.yupoo.com/categories/123" title="Men&#x27;s Shoes">dup</a>
`;

test("parses id + decoded title, skips all/0, dedupes", () => {
  assert.deepEqual(parseCategories(HTML), [
    { id: "5225737", title: "👜D&G" },
    { id: "5225748", title: "👜The Row" },
    { id: "123", title: "Men's Shoes" },
  ]);
});

test("empty page parses to empty list", () => {
  assert.deepEqual(parseCategories("<html></html>"), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module ... yupoo-categories.mjs`.

- [ ] **Step 3: Write the parser**

Create `web-v2/scripts/lib/yupoo-categories.mjs`:

```js
// Extract (category id, title) pairs from a Yupoo /categories page. Yupoo
// renders anchors with single-quoted attributes; titles carry emoji, HTML
// entities, and censored brand spellings — decode but do not normalize here
// (normalization is the LLM's job in the crawl script).
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

export function parseCategories(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/categories\/(\d+)[^>]*?title=['"]([^'"]+)['"]/g)) {
    const id = m[1];
    if (id === "0" || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: decode(m[2]) });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the crawl script**

Create `web-v2/scripts/crawl-seller-categories.mjs`:

```js
// Crawl every seller's Yupoo /categories page, LLM-map category titles to
// canonical brand names, and upsert seller_brand_links. Idempotent: existing
// urls are updated in place, vanished categories are deactivated, other
// sellers' rows are never touched. Run from web-v2/:
//
//   GEMINI_API_KEY=... node scripts/crawl-seller-categories.mjs           # all sellers
//   GEMINI_API_KEY=... node scripts/crawl-seller-categories.mjs --dry     # print only
//   GEMINI_API_KEY=... node scripts/crawl-seller-categories.mjs --only deateath
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";
import { parseCategories } from "./lib/yupoo-categories.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("set GEMINI_API_KEY"); process.exit(1); }
const DRY = process.argv.includes("--dry");
const ONLY = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      brand: { type: "STRING", nullable: true },
    },
    required: ["title", "brand"],
  },
};

async function gemini(parts, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) {
      const txt = j.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) return JSON.parse(txt);
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (t + 1)));
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${j.error?.message || "?"}`);
  }
  throw new Error("retries exhausted");
}

const PROMPT = (titles) =>
  `These are category titles from a Chinese rep-fashion seller's Yupoo photo site. ` +
  `Map each to the canonical fashion brand name, or null when the category is not a single brand ` +
  `(garment types like "T-SHIRT T恤", info pages like "About Us", multi-brand groupings, "other").\n` +
  `Sellers censor brand names — expand them: "P⭐A⭐A"→"Prada", "B⭐L⭐⭐⭐IA⭐A"→"Balenciaga", ` +
  `"R* Lau*ren"→"Ralph Lauren", "Bru*nello c*"→"Brunello Cucinelli", "LP"→"Loro Piana", ` +
  `"BV"→"Bottega Veneta", "BLCG"→"Balenciaga", "GGDB"→"Golden Goose", "TR"→"The Row", ` +
  `"N⭐K⭐"→"Nike", "CDG"→"Comme des Garçons", "MM6"/"Margiela"→"Maison Margiela". ` +
  `Strip emoji and qualifiers ("👜The Row"→"The Row", "ACNE jeans"→"Acne Studios"). ` +
  `Return one entry per input title, same order.\n\nTitles:\n` +
  titles.map((t) => `- ${t}`).join("\n");

const { data: sellers, error } = await sb
  .from("sellers")
  .select("name, yupoo_url")
  .not("yupoo_url", "is", null);
if (error) { console.error(error.message); process.exit(1); }

let targets = sellers.map((s) => ({
  name: s.name,
  sub: new URL(s.yupoo_url).hostname.split(".")[0].toLowerCase(),
}));
if (ONLY) targets = targets.filter((t) => t.sub === ONLY);
console.log(`${targets.length} sellers${DRY ? " (dry)" : ""}\n`);

for (const t of targets) {
  const label = `${t.sub} (Yupoo)`;
  try {
    const res = await fetch(`https://${t.sub}.x.yupoo.com/categories`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.log(`${t.sub}: HTTP ${res.status}, skipped`); continue; }
    const cats = parseCategories(await res.text());
    if (!cats.length) { console.log(`${t.sub}: 0 categories, skipped`); continue; }

    const mapped = await gemini([{ text: PROMPT(cats.map((c) => c.title)) }]);
    const byTitle = new Map(mapped.map((m) => [m.title, m.brand]));
    const rows = cats
      .map((c) => ({
        seller: label,
        brand: byTitle.get(c.title) ?? null,
        alias: c.title,
        url: `https://${t.sub}.x.yupoo.com/categories/${c.id}`,
        active: true,
      }))
      .filter((r) => r.brand);
    console.log(`${t.sub}: ${cats.length} categories → ${rows.length} brand links`);
    if (DRY) { rows.slice(0, 8).forEach((r) => console.log(`   ${r.brand}  ←  ${r.alias}`)); continue; }

    const { data: existing } = await sb
      .from("seller_brand_links")
      .select("id, url")
      .eq("seller", label);
    const existingByUrl = new Map((existing ?? []).map((e) => [e.url, e.id]));
    const liveUrls = new Set(rows.map((r) => r.url));

    for (const r of rows) {
      const id = existingByUrl.get(r.url);
      if (id) await sb.from("seller_brand_links").update(r).eq("id", id);
      else await sb.from("seller_brand_links").insert(r);
    }
    // Page fetched fine, so a missing category really is gone (spec §3.4).
    const gone = (existing ?? []).filter((e) => !liveUrls.has(e.url));
    for (const e of gone)
      await sb.from("seller_brand_links").update({ active: false }).eq("id", e.id);
    if (gone.length) console.log(`   deactivated ${gone.length} vanished links`);
  } catch (e) {
    console.log(`${t.sub}: ${e.message}, skipped`);
  }
}
console.log("\ndone");
```

- [ ] **Step 6: Dry-run one messy seller, then run for real**

Run (from `web-v2/`, with `GEMINI_API_KEY` from setset-vault, same as the classify pipeline):

```bash
GEMINI_API_KEY=$KEY node scripts/crawl-seller-categories.mjs --dry --only deateath
```

Expected: `deateath: ~350 categories → N brand links` with sensible mappings printed (P⭐A⭐A → Prada). Spot-check 8 lines. Then run the full crawl:

```bash
GEMINI_API_KEY=$KEY node scripts/crawl-seller-categories.mjs
```

Expected: one line per seller, no unhandled errors. Verify:

```sql
select count(*), count(distinct seller) from seller_brand_links where active;
```

— seller count should rise from 15 toward ~40, total rows well above 2,469.

- [ ] **Step 7: Commit**

```bash
git add web-v2/scripts/lib/yupoo-categories.mjs web-v2/scripts/lib/yupoo-categories.test.mjs web-v2/scripts/crawl-seller-categories.mjs
git commit -m "feat(v2): crawl seller yupoo categories into seller_brand_links"
```

---

### Task 8: Full verification, PR

**Files:** none new.

- [ ] **Step 1: Full local gate**

From `web-v2/`: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all clean.

- [ ] **Step 2: Browser E2E (Playwright MCP or manual, per repo rule "browser-repro before PR")**

Against `npm run dev` with a real friend login:
1. `/hampus/factories` — copy correct (no "Yupoo" anywhere), 40+ factory cards, nav order Shop · Factories · Profile · Haul.
2. Search `prada` — direct-link cards first ("Prada at Deateath →" style), each opening a Yupoo category in a new tab; capitalized names.
3. Search `zzzz` — empty-state line renders, add box still visible.
4. Shop search `prada` — "Can't find it? Search our factories →" appears and carries the query.
5. Paste a live Yupoo album link — added-confirmation, haul shows "Finding the details…" then (refresh ~15s) title + mirrored Supabase image, admin inbox shows the request with any price note.
6. Paste a Weidian link — inbox row shows "Open in Superbuy →".
7. Paste junk — inline error, no item row created.

- [ ] **Step 3: PR + merge**

```bash
git push -u origin feat/factories
gh pr create --title "feat(v2): Factories tab - curated seller search + paste-link sourcing" --body "$(cat <<'EOF'
## What

- New Factories tab (Shop · Factories · Profile · Haul): friends search any brand across our 41 curated sellers and get direct deep links into each seller's Yupoo brand category (seller_brand_links, grouped by Yupoo subdomain).
- Paste-link add box: any Yupoo/Weidian/Taobao/Superbuy link lands in the haul instantly as "sourcing"; title, hero image (mirrored to Supabase Storage), and listed price are filled in the background via next/server after(). Failures degrade to a plain link request.
- Admin inbox now includes sourcing items, shows the scraped price note, and builds the Superbuy wrapper on the fly for Weidian/Taobao sources.
- crawl-seller-categories.mjs: re-runnable crawler that maps each seller's Yupoo category titles to canonical brands via Gemini and upserts seller_brand_links.

Spec: docs/superpowers/specs/2026-07-30-factories-search-design.md
Plan: docs/superpowers/plans/2026-07-30-factories-search.md

## Testing

- node --test units: link classifier, page parsers, factory grouping, category parser
- tsc, eslint, next build clean
- Browser E2E per plan Task 8 (factories search, paste-link happy path, junk link, inbox)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Follow the repo merge guardrail: run the code-review pass, `touch` the `PR_REVIEW_PASSED_<sha>` marker (separate Bash call), then `ALLOW_AUTO_MERGE=1 gh pr merge --squash`.
