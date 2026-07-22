# Welcome Onboarding + Size Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-visit welcome page (copy + address + optional sizing profile) for invited friends, a profile page to edit it later, and live per-product size recommendations that match the friend's estimated body measurements against each product's scraped cm size chart.

**Architecture:** A new `onboarded_at` column gates a one-time `/{handle}/welcome` redirect from the `/f/<token>` invite route. Address + measurements save into the existing `friends.shipping_address` / `friends.measurements` jsonb columns via a server action. A pure TS module `src/lib/sizing.ts` (unit-tested with `node --test`, no framework imports) converts profile inputs to body cm estimates and matches them against `products.size_guide`; the friend product page calls it server-side on every render — nothing precomputed.

**Tech Stack:** Next.js 16.2.10 App Router (async `params`, server actions), Supabase (project ref `pqfiwdscftwhmcutspay`, admin client server-side), Tailwind 4, `node:test` (Node 26 runs `.ts` test files natively via type stripping).

**Spec:** `docs/superpowers/specs/2026-07-22-welcome-onboarding-sizing-design.md`

## Global Constraints

- Working dir for all commands: `web-v2/` (repo `/…/haulhq/lima`). Commit from repo root.
- **Read `node_modules/next/dist/docs/`** guides before writing any Next.js page/action code (AGENTS.md rule: this Next version differs from training data).
- Identity always comes from the `friend_token` cookie via `getCurrentFriend()` — NEVER from the URL handle (IDOR rule, see `src/app/[handle]/haul-actions.ts`).
- Welcome copy must NOT mention "Hampus" by name. Exact copy strings are given in Task 4 — use them verbatim.
- Everything on the welcome page is skippable; sizing block is labeled "optional".
- No recommendation without data: product without usable chart (non-shoe) → no rec; friend without profile → "Add your sizes" link, never a guess.
- Supabase writes use `createAdminClient()` from `@/lib/supabase/admin` (server only).
- All numbers stored metric: `height_cm`, `weight_kg`; jeans waist stored in inches (it's a US size label), foot/chest/shoulder in cm.

---

### Task 1: Migration + shared types

**Files:**
- Modify: `web-v2/src/lib/types.ts` (Friend interface, new Measurements/ShippingAddress)
- DB: `alter table friends` via Supabase MCP `apply_migration` (project `pqfiwdscftwhmcutspay`)

**Interfaces:**
- Consumes: nothing.
- Produces: `Measurements`, `ShippingAddress` interfaces and `Friend.onboarded_at: string | null` — used by every later task. Exact shapes below.

- [ ] **Step 1: Apply the migration**

Use the Supabase MCP tool `apply_migration` with name `add_friends_onboarded_at` and query:

```sql
alter table public.friends add column if not exists onboarded_at timestamptz;
```

- [ ] **Step 2: Verify column exists**

Run MCP `execute_sql`: `select column_name from information_schema.columns where table_name='friends' and column_name='onboarded_at';`
Expected: one row.

- [ ] **Step 3: Update types**

In `web-v2/src/lib/types.ts`, add above the `Friend` interface:

```ts
export interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  phone?: string;
}

// All fields optional — friends fill in as much as they want.
export interface Measurements {
  gender?: "male" | "female" | "na";
  height_cm?: number;
  weight_kg?: number;
  jeans_waist_in?: number;
  shoe?: { system: "us" | "eu"; value: number };
  fit_pref?: "slim" | "true" | "oversized";
  // Explicit tape-measure values; when present they override estimates.
  explicit?: { chest_cm?: number; shoulder_cm?: number; foot_cm?: number };
}
```

and change the `Friend` interface fields:

```ts
  shipping_address: ShippingAddress | null;
  measurements: Measurements | null;
  onboarded_at: string | null;
```

(replacing the existing `shipping_address: Record<string, unknown> | null;` and `measurements: Record<string, number> | null;` lines).

- [ ] **Step 4: Typecheck**

Run: `cd web-v2 && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web-v2/src/lib/types.ts
git commit -m "feat(v2): onboarded_at column + Measurements/ShippingAddress types"
```

---

### Task 2: Sizing engine — conversions + body estimation (TDD)

**Files:**
- Create: `web-v2/src/lib/sizing.ts`
- Create: `web-v2/src/lib/sizing.test.ts`
- Modify: `web-v2/tsconfig.json` (exclude test files), `web-v2/package.json` (test script)

**Interfaces:**
- Consumes: `Measurements` from `./types` (Task 1).
- Produces (exact signatures, used by Task 3 + Task 6):

```ts
export function ftInToCm(ft: number, inch: number): number
export function lbsToKg(lbs: number): number
export function jeansWaistToCm(waistIn: number): number
export function shoeToFootCm(system: "us" | "eu", value: number, gender?: Measurements["gender"]): number | null
export function estimateChestCm(m: Measurements): number | null
export function estimateWaistCm(m: Measurements): number | null
export function estimateFootCm(m: Measurements): number | null
```

- [ ] **Step 1: Test plumbing.** In `web-v2/tsconfig.json` add `"**/*.test.ts"` to the `exclude` array (create the array alongside the existing excludes if needed — keep `node_modules` excluded). In `web-v2/package.json` scripts add:

```json
"test": "node --test src/lib/ scripts/lib/"
```

(Node 26 discovers and runs `*.test.ts` / `*.test.mjs` in those dirs natively. Test files import with explicit `.ts` extension, which is why tsc must exclude them.)

- [ ] **Step 2: Write the failing tests**

`web-v2/src/lib/sizing.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ftInToCm, lbsToKg, jeansWaistToCm, shoeToFootCm,
  estimateChestCm, estimateWaistCm, estimateFootCm,
} from "./sizing.ts";

test("unit conversions", () => {
  assert.equal(ftInToCm(5, 11), 180.3);
  assert.equal(lbsToKg(165), 74.8);
  assert.equal(jeansWaistToCm(32), 86.4); // (32+2)*2.54, vanity offset
});

test("shoe size to foot cm", () => {
  assert.equal(shoeToFootCm("us", 9, "male"), 26.8);
  assert.equal(shoeToFootCm("us", 8, "male"), 26.0);
  assert.equal(shoeToFootCm("eu", 42), 26.7);
  assert.equal(shoeToFootCm("eu", 41), 26.0);
  // women's US runs 1.5 sizes offset from men's on the same last
  assert.equal(shoeToFootCm("us", 8, "female"), shoeToFootCm("us", 6.5, "male"));
  assert.equal(shoeToFootCm("us", NaN, "male"), null);
});

test("chest estimation from height/weight/gender", () => {
  // male anchors: 180/75 ≈ 99, 170/60 ≈ 89, 190/95 ≈ 112 (±2cm)
  const est = (h: number, w: number, g: "male" | "female") =>
    estimateChestCm({ gender: g, height_cm: h, weight_kg: w })!;
  assert.ok(Math.abs(est(180, 75, "male") - 99) <= 2);
  assert.ok(Math.abs(est(170, 60, "male") - 89) <= 2);
  assert.ok(Math.abs(est(190, 95, "male") - 112) <= 2);
  assert.ok(est(170, 60, "female") < est(170, 60, "male"));
  // missing inputs → null
  assert.equal(estimateChestCm({ height_cm: 180 }), null);
});

test("explicit measurements override estimates", () => {
  const m = {
    gender: "male" as const, height_cm: 180, weight_kg: 75,
    jeans_waist_in: 32, shoe: { system: "us" as const, value: 9 },
    explicit: { chest_cm: 104, foot_cm: 27.2 },
  };
  assert.equal(estimateChestCm(m), 104);
  assert.equal(estimateFootCm(m), 27.2);
  assert.equal(estimateWaistCm(m), 86.4); // no explicit waist → jeans-derived
});

test("estimateWaistCm and estimateFootCm fall back to null", () => {
  assert.equal(estimateWaistCm({}), null);
  assert.equal(estimateFootCm({}), null);
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `cd web-v2 && npm test`
Expected: FAIL — cannot find module `./sizing.ts`.

- [ ] **Step 4: Implement**

`web-v2/src/lib/sizing.ts` (part 1 — Task 3 appends to this file):

```ts
// Pure sizing math — no framework imports, unit-tested with node --test.
// All outputs cm, rounded to 0.1. Estimation is deliberately simple linear
// anthropometry: good to ±one size, which is all chart-matching needs.
import type { Measurements } from "./types";

const r1 = (n: number) => Math.round(n * 10) / 10;

export function ftInToCm(ft: number, inch: number): number {
  return r1((ft * 12 + inch) * 2.54);
}

export function lbsToKg(lbs: number): number {
  return r1(lbs * 0.45359237);
}

// A jeans "32" is vanity-sized: actual garment waist ≈ 34in.
export function jeansWaistToCm(waistIn: number): number {
  return r1((waistIn + 2) * 2.54);
}

// Linear shoe lasts: men's US 6 = 24.4cm, +0.8cm per full size.
// Women's US = men's minus 1.5 on the same last. EU: (eu − 2) × 2⁄3.
export function shoeToFootCm(
  system: "us" | "eu",
  value: number,
  gender?: Measurements["gender"],
): number | null {
  if (!Number.isFinite(value)) return null;
  if (system === "eu") return r1(((value - 2) * 2) / 3);
  const menUs = gender === "female" ? value - 1.5 : value;
  return r1(24.4 + (menUs - 6) * 0.8);
}

// chest = a + 0.55·kg + 0.15·cm — fitted to male anchors (170/60→89,
// 180/75→99, 190/95→112). Female bust sits ~4cm under the male line
// at equal build.
export function estimateChestCm(m: Measurements): number | null {
  if (m.explicit?.chest_cm) return r1(m.explicit.chest_cm);
  if (!m.height_cm || !m.weight_kg) return null;
  const base = 31 + 0.55 * m.weight_kg + 0.15 * m.height_cm;
  return r1(m.gender === "female" ? base - 4 : base);
}

export function estimateWaistCm(m: Measurements): number | null {
  if (m.jeans_waist_in) return jeansWaistToCm(m.jeans_waist_in);
  return null;
}

export function estimateFootCm(m: Measurements): number | null {
  if (m.explicit?.foot_cm) return r1(m.explicit.foot_cm);
  if (m.shoe) return shoeToFootCm(m.shoe.system, m.shoe.value, m.gender);
  return null;
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd web-v2 && npm test`
Expected: all sizing tests PASS (plus the two existing `scripts/lib` suites).

- [ ] **Step 6: Typecheck + commit**

Run: `cd web-v2 && npx tsc --noEmit` — expected clean.

```bash
git add web-v2/src/lib/sizing.ts web-v2/src/lib/sizing.test.ts web-v2/tsconfig.json web-v2/package.json
git commit -m "feat(v2): sizing conversions + body estimation (TDD)"
```

---

### Task 3: Sizing engine — chart matching + recommendSize (TDD)

**Files:**
- Modify: `web-v2/src/lib/sizing.ts` (append)
- Modify: `web-v2/src/lib/sizing.test.ts` (append)

**Interfaces:**
- Consumes: estimation functions from Task 2; `SizeGuide`, `Measurements` from `./types`.
- Produces (used by Task 6):

```ts
export interface SizeRec { size: string; reason: string }
export function recommendSize(
  m: Measurements | null,
  product: {
    category: string | null;
    size_options: string[];
    size_guide: SizeGuide | null;
  },
): SizeRec | null
```

**Chart reality (from live DB):** measurement keys vary — `chest`(19), `bust`(5), `pit_to_pit`(6), `half_chest`(4), `waist`(20), `half_waist`(3), `insole_length`(1); units are `"cm"` or `"in"`. Normalization must handle aliases, half-measurements (×2), and inch charts (×2.54). Defensive rule: after aliasing, a "chest" value < 70 or a "waist" value < 55 is a half measurement → double it.

- [ ] **Step 1: Append failing tests**

Append to `web-v2/src/lib/sizing.test.ts`:

```ts
import { recommendSize } from "./sizing.ts";

const HAMPUS = {
  gender: "male" as const, height_cm: 183, weight_kg: 72,
  jeans_waist_in: 31, shoe: { system: "eu" as const, value: 41 },
  fit_pref: "true" as const,
};

test("recommendSize: top via chest chart, true-to-size ease band", () => {
  const rec = recommendSize(HAMPUS, {
    category: "t-shirts",
    size_options: ["S", "M", "L", "XL"],
    size_guide: {
      unit: "cm", sizes: ["S", "M", "L", "XL"],
      measurements: { chest: [104, 108, 112, 116], length: [68, 70, 72, 74] },
    },
  });
  // body chest ≈ 98; true band mid = +11 → 108–112 closest ⇒ M (108, ease 10)
  assert.equal(rec!.size, "M");
  assert.match(rec!.reason, /chest 108cm/);
  assert.match(rec!.reason, /~98(\.\d)?cm/); // estimate lands at 98.1
});

test("recommendSize: bust + half_chest aliases and inch charts normalize", () => {
  const bust = recommendSize(HAMPUS, {
    category: "shirts", size_options: ["M", "L"],
    size_guide: { unit: "cm", sizes: ["M", "L"], measurements: { bust: [108, 112] } },
  });
  assert.equal(bust!.size, "M");
  const half = recommendSize(HAMPUS, {
    category: "shirts", size_options: ["M", "L"],
    size_guide: { unit: "cm", sizes: ["M", "L"], measurements: { pit_to_pit: [54, 56] } },
  });
  assert.equal(half!.size, "M"); // 54×2 = 108
  const inches = recommendSize(HAMPUS, {
    category: "shirts", size_options: ["M", "L"],
    size_guide: { unit: "in", sizes: ["M", "L"], measurements: { chest: [42.5, 44] } },
  });
  assert.equal(inches!.size, "M"); // 42.5in = 108cm
});

test("recommendSize: fit preference shifts the pick", () => {
  const chart = {
    category: "hoodies", size_options: ["S", "M", "L", "XL"],
    size_guide: {
      unit: "cm" as const, sizes: ["S", "M", "L", "XL"],
      measurements: { chest: [104, 110, 116, 122] },
    },
  };
  assert.equal(recommendSize({ ...HAMPUS, fit_pref: "slim" }, chart)!.size, "S");
  assert.equal(recommendSize({ ...HAMPUS, fit_pref: "oversized" }, chart)!.size, "L");
});

test("recommendSize: pants match on waist", () => {
  const rec = recommendSize(HAMPUS, {
    category: "pants", size_options: ["46", "48", "50"],
    size_guide: {
      unit: "cm", sizes: ["46", "48", "50"],
      measurements: { waist: [80, 84, 88], length: [100, 102, 104] },
    },
  });
  // jeans 31 → body waist 83.8 → 84 waist +ease band 0–4 ⇒ 48
  assert.equal(rec!.size, "48");
  assert.match(rec!.reason, /waist/);
});

test("recommendSize: shoes work from EU size_options without a chart", () => {
  const rec = recommendSize(HAMPUS, {
    category: "shoes", size_options: ["40", "41", "42", "43"],
    size_guide: null,
  });
  assert.equal(rec!.size, "41"); // EU41 = 26.0cm = his foot
});

test("recommendSize: best chart size missing from size_options → nearest available", () => {
  const rec = recommendSize(HAMPUS, {
    category: "t-shirts",
    size_options: ["S", "L"], // M gone
    size_guide: {
      unit: "cm", sizes: ["S", "M", "L"],
      measurements: { chest: [104, 108, 112] },
    },
  });
  assert.equal(rec!.size, "L");
  assert.match(rec!.reason, /closest available/);
});

test("recommendSize: no guessing", () => {
  const noChart = recommendSize(HAMPUS, {
    category: "t-shirts", size_options: ["S", "M"], size_guide: null,
  });
  assert.equal(noChart, null);
  const noProfile = recommendSize(null, {
    category: "t-shirts", size_options: ["S", "M"],
    size_guide: { unit: "cm", sizes: ["S"], measurements: { chest: [108] } },
  });
  assert.equal(noProfile, null);
  const accessory = recommendSize(HAMPUS, {
    category: "accessories", size_options: [], size_guide: null,
  });
  assert.equal(accessory, null);
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `cd web-v2 && npm test`
Expected: FAIL — `recommendSize` not exported.

- [ ] **Step 3: Implement**

Append to `web-v2/src/lib/sizing.ts`:

```ts
import type { SizeGuide } from "./types";

export interface SizeRec {
  size: string;
  reason: string;
}

const TOP_CATS = new Set([
  "t-shirts", "shirts", "knitwear", "hoodies", "blazers", "jackets", "outerwear",
]);
const PANT_CATS = new Set(["pants", "shorts"]);

// Desired garment−body ease (cm) per fit preference, tops.
const EASE_MID = { slim: 6, true: 11, oversized: 18 } as const;

// Pull one normalized full-circumference row (cm) out of a chart.
function chartRow(
  guide: SizeGuide,
  aliases: { full: string[]; half: string[] },
  doubleBelow: number,
): number[] | null {
  const toCm = guide.unit === "in" ? 2.54 : 1;
  for (const key of [...aliases.full, ...aliases.half]) {
    const row = guide.measurements[key];
    if (!row) continue;
    const isHalf = aliases.half.includes(key);
    return row.map((v) => {
      if (v == null) return NaN;
      let cm = v * toCm;
      if (isHalf || cm < doubleBelow) cm *= 2;
      return cm;
    });
  }
  return null;
}

function nearestAvailable(
  best: string,
  ordered: string[],
  available: string[],
): { size: string; fallback: boolean } {
  if (available.length === 0 || available.includes(best))
    return { size: best, fallback: false };
  const i = ordered.indexOf(best);
  let pick: string | null = null;
  let pickJ = -1;
  let dist = Infinity;
  for (const s of available) {
    const j = ordered.indexOf(s);
    if (j === -1) continue;
    const d = Math.abs(j - i);
    // On a tie, size UP — too roomy beats too tight.
    if (d < dist || (d === dist && j > pickJ)) { dist = d; pick = s; pickJ = j; }
  }
  return pick ? { size: pick, fallback: true } : { size: best, fallback: false };
}

// Parse "42", "EU 42", "42.5" → 42.5; null for non-numeric labels.
function euFromLabel(label: string): number | null {
  const m = label.match(/(\d{2}(?:\.\d)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function recommendSize(
  m: Measurements | null,
  product: {
    category: string | null;
    size_options: string[];
    size_guide: SizeGuide | null;
  },
): SizeRec | null {
  if (!m) return null;
  const cat = product.category ?? "";

  if (cat === "shoes") {
    const foot = estimateFootCm(m);
    if (foot == null) return null;
    // Prefer an insole row; otherwise the EU size labels ARE the chart.
    const insole =
      product.size_guide ? chartRow(product.size_guide, { full: ["insole_length", "foot_length"], half: [] }, 0) : null;
    if (insole && product.size_guide) {
      let best = 0;
      insole.forEach((v, i) => {
        if (Math.abs(v - foot) < Math.abs(insole[best] - foot)) best = i;
      });
      const size = product.size_guide.sizes[best];
      return { size, reason: `${size} — insole ${r1(insole[best])}cm vs your foot ~${foot}cm` };
    }
    const eus = product.size_options
      .map((label) => ({ label, cm: euFromLabel(label) != null ? shoeToFootCm("eu", euFromLabel(label)!) : null }))
      .filter((e): e is { label: string; cm: number } => e.cm != null);
    if (eus.length === 0) return null;
    const best = eus.reduce((a, b) =>
      Math.abs(b.cm - foot) < Math.abs(a.cm - foot) ? b : a);
    return { size: best.label, reason: `EU ${best.label} ≈ ${best.cm}cm — your foot ~${foot}cm` };
  }

  if (!product.size_guide) return null;
  const guide = product.size_guide;

  if (TOP_CATS.has(cat)) {
    const body = estimateChestCm(m);
    if (body == null) return null;
    const chest = chartRow(
      guide,
      { full: ["chest", "bust"], half: ["pit_to_pit", "half_chest"] },
      70,
    );
    if (!chest) return null;
    const mid = EASE_MID[m.fit_pref ?? "true"];
    let best = -1;
    chest.forEach((v, i) => {
      if (Number.isNaN(v)) return;
      if (best === -1 || Math.abs(v - body - mid) < Math.abs(chest[best] - body - mid))
        best = i;
    });
    if (best === -1) return null;
    const picked = nearestAvailable(guide.sizes[best], guide.sizes, product.size_options);
    const ease = chest[guide.sizes.indexOf(picked.size)] - body;
    const feel = ease < 4 ? "snug" : ease > 14 ? "relaxed" : "regular fit";
    const chartCm = r1(chest[guide.sizes.indexOf(picked.size)]);
    const note = picked.fallback ? " (closest available)" : "";
    return {
      size: picked.size,
      reason: `${picked.size} — chart chest ${chartCm}cm vs your ~${body}cm, ${feel}${note}`,
    };
  }

  if (PANT_CATS.has(cat)) {
    const body = estimateWaistCm(m);
    if (body == null) return null;
    const waist = chartRow(guide, { full: ["waist"], half: ["half_waist"] }, 55);
    if (!waist) return null;
    // Pants ease band 0–4cm over body waist; aim +2.
    let best = -1;
    waist.forEach((v, i) => {
      if (Number.isNaN(v)) return;
      if (best === -1 || Math.abs(v - body - 2) < Math.abs(waist[best] - body - 2))
        best = i;
    });
    if (best === -1) return null;
    const picked = nearestAvailable(guide.sizes[best], guide.sizes, product.size_options);
    const chartCm = r1(waist[guide.sizes.indexOf(picked.size)]);
    const note = picked.fallback ? " (closest available)" : "";
    return {
      size: picked.size,
      reason: `${picked.size} — chart waist ${chartCm}cm vs your ~${body}cm${note}`,
    };
  }

  return null; // bags / accessories / glasses: no sizing
}
```

Note: `r1` is already defined at the top of the file (Task 2); `import type { SizeGuide }` merges with the existing `import type { Measurements }` — combine them into one import statement.

- [ ] **Step 4: Run tests, verify all pass**

Run: `cd web-v2 && npm test`
Expected: all PASS. If an ease-band test picks a neighbor size, fix the implementation (not the test) — the anchors were chosen to be unambiguous.

- [ ] **Step 5: Typecheck + commit**

Run: `cd web-v2 && npx tsc --noEmit` — clean.

```bash
git add web-v2/src/lib/sizing.ts web-v2/src/lib/sizing.test.ts
git commit -m "feat(v2): recommendSize chart matcher (aliases, ease bands, shoe EU fallback)"
```

---

### Task 4: Save action, ProfileForm, welcome page, invite redirect

**Files:**
- Create: `web-v2/src/app/[handle]/profile-actions.ts`
- Create: `web-v2/src/components/ProfileForm.tsx`
- Create: `web-v2/src/app/[handle]/welcome/page.tsx`
- Modify: `web-v2/src/app/f/[token]/route.ts`

**Interfaces:**
- Consumes: `Measurements`, `ShippingAddress` (Task 1); `getCurrentFriend` from `@/lib/friend`; `createAdminClient` from `@/lib/supabase/admin`.
- Produces: server action `saveProfile(input: { address: ShippingAddress | null; measurements: Measurements | null }): Promise<{ ok: boolean; error?: string }>` — also used by Task 5. `ProfileForm` props: `{ handle: string; mode: "welcome" | "profile"; initialAddress: ShippingAddress | null; initialMeasurements: Measurements | null }`.

- [ ] **Step 0: Read the Next.js guides** — `ls web-v2/node_modules/next/dist/docs/` and read the server-actions / forms / redirecting guides before writing the code below; adjust if the API differs.

- [ ] **Step 1: Server action**

`web-v2/src/app/[handle]/profile-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";
import type { Measurements, ShippingAddress } from "@/lib/types";

// Saves whatever the friend filled in and stamps onboarded_at on first save.
// Passing nulls (welcome-page "Skip for now") still stamps — the welcome page
// must never auto-appear twice. Identity from the cookie, never the URL.
export async function saveProfile(input: {
  address: ShippingAddress | null;
  measurements: Measurements | null;
}): Promise<{ ok: boolean; error?: string }> {
  const friend = await getCurrentFriend();
  if (!friend) return { ok: false, error: "Open your personal invite link first." };

  const patch: Record<string, unknown> = {};
  if (input.address) patch.shipping_address = input.address;
  if (input.measurements) patch.measurements = input.measurements;
  if (!friend.onboarded_at) patch.onboarded_at = new Date().toISOString();

  if (Object.keys(patch).length > 0) {
    const sb = createAdminClient();
    const { error } = await sb.from("friends").update(patch).eq("id", friend.id);
    if (error) return { ok: false, error: error.message };
  }
  if (friend.handle) {
    revalidatePath(`/${friend.handle}/profile`);
    revalidatePath(`/${friend.handle}/welcome`);
  }
  return { ok: true };
}
```

- [ ] **Step 2: ProfileForm client component**

`web-v2/src/components/ProfileForm.tsx` — one form used by both welcome and profile pages. Controlled state, unit toggles convert on the fly, all fields optional. Complete component:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/app/[handle]/profile-actions";
import { ftInToCm, lbsToKg } from "@/lib/sizing";
import type { Measurements, ShippingAddress } from "@/lib/types";

const label = "block text-[9px] uppercase tracking-widest text-neutral-400 mb-1";
const input =
  "w-full border border-neutral-300 px-2 py-1.5 text-sm focus:border-black focus:outline-none";
const chip = (on: boolean) =>
  `border px-2 py-1 text-[10px] ${on ? "border-black bg-black text-white" : "border-neutral-300 text-neutral-600 hover:border-black"}`;

export function ProfileForm({
  handle,
  mode,
  initialAddress,
  initialMeasurements,
}: {
  handle: string;
  mode: "welcome" | "profile";
  initialAddress: ShippingAddress | null;
  initialMeasurements: Measurements | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addr, setAddr] = useState<ShippingAddress>(initialAddress ?? { country: "US" });
  const m0 = initialMeasurements ?? {};
  const [gender, setGender] = useState(m0.gender ?? "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">("cm");
  const [heightCm, setHeightCm] = useState(m0.height_cm?.toString() ?? "");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [weight, setWeight] = useState(m0.weight_kg?.toString() ?? "");
  const [jeans, setJeans] = useState(m0.jeans_waist_in?.toString() ?? "");
  const [shoeSystem, setShoeSystem] = useState<"us" | "eu">(m0.shoe?.system ?? "us");
  const [shoeVal, setShoeVal] = useState(m0.shoe?.value?.toString() ?? "");
  const [fitPref, setFitPref] = useState(m0.fit_pref ?? "");
  const [chest, setChest] = useState(m0.explicit?.chest_cm?.toString() ?? "");
  const [shoulder, setShoulder] = useState(m0.explicit?.shoulder_cm?.toString() ?? "");
  const [foot, setFoot] = useState(m0.explicit?.foot_cm?.toString() ?? "");

  function collect(): { address: ShippingAddress | null; measurements: Measurements | null } {
    const hasAddr = Object.values(addr).some((v) => (v ?? "").toString().trim() !== "");
    const num = (s: string) => (s.trim() === "" || Number.isNaN(+s) ? undefined : +s);
    const h =
      heightUnit === "cm"
        ? num(heightCm)
        : num(heightFt) != null
          ? ftInToCm(num(heightFt)!, num(heightIn) ?? 0)
          : undefined;
    const w = weightUnit === "kg" ? num(weight) : num(weight) != null ? lbsToKg(num(weight)!) : undefined;
    const explicit = {
      ...(num(chest) != null && { chest_cm: num(chest) }),
      ...(num(shoulder) != null && { shoulder_cm: num(shoulder) }),
      ...(num(foot) != null && { foot_cm: num(foot) }),
    };
    const meas: Measurements = {
      ...(gender && { gender: gender as Measurements["gender"] }),
      ...(h != null && { height_cm: h }),
      ...(w != null && { weight_kg: w }),
      ...(num(jeans) != null && { jeans_waist_in: num(jeans) }),
      ...(num(shoeVal) != null && { shoe: { system: shoeSystem, value: num(shoeVal)! } }),
      ...(fitPref && { fit_pref: fitPref as Measurements["fit_pref"] }),
      ...(Object.keys(explicit).length > 0 && { explicit }),
    };
    return {
      address: hasAddr ? addr : null,
      measurements: Object.keys(meas).length > 0 ? meas : null,
    };
  }

  function submit(skip: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await saveProfile(skip ? { address: null, measurements: null } : collect());
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      if (mode === "welcome") router.push(`/${handle}/shop`);
      else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    });
  }

  const setA = (k: keyof ShippingAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddr((a) => ({ ...a, [k]: e.target.value }));

  return (
    <div className="space-y-10">
      {/* ADDRESS */}
      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-widest">Delivery address</h2>
        <p className="mb-4 text-xs text-neutral-500">
          For easy delivery, enter your address and we&apos;ll save it for your orders.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><span className={label}>Full name</span>
            <input className={input} value={addr.name ?? ""} onChange={setA("name")} /></div>
          <div className="sm:col-span-2"><span className={label}>Street address</span>
            <input className={input} value={addr.line1 ?? ""} onChange={setA("line1")} /></div>
          <div className="sm:col-span-2"><span className={label}>Apt / unit (optional)</span>
            <input className={input} value={addr.line2 ?? ""} onChange={setA("line2")} /></div>
          <div><span className={label}>City</span>
            <input className={input} value={addr.city ?? ""} onChange={setA("city")} /></div>
          <div><span className={label}>State / region</span>
            <input className={input} value={addr.region ?? ""} onChange={setA("region")} /></div>
          <div><span className={label}>ZIP / postal code</span>
            <input className={input} value={addr.postal ?? ""} onChange={setA("postal")} /></div>
          <div><span className={label}>Country</span>
            <input className={input} value={addr.country ?? ""} onChange={setA("country")} /></div>
          <div className="sm:col-span-2"><span className={label}>Phone</span>
            <input className={input} value={addr.phone ?? ""} onChange={setA("phone")} /></div>
        </div>
      </section>

      {/* SIZING */}
      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-widest">
          Sizing <span className="font-normal text-neutral-400">(optional)</span>
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
          Sizing on these pieces can run a little off from what you&apos;re used to.
          Enter your details and we&apos;ll guide you to the most accurate size on
          every product. If you know your real measurements, even better.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><span className={label}>Gender</span>
            <div className="flex gap-1.5">
              {(["male", "female", "na"] as const).map((g) => (
                <button type="button" key={g} onClick={() => setGender(gender === g ? "" : g)} className={chip(gender === g)}>
                  {g === "na" ? "prefer not to say" : g}
                </button>
              ))}
            </div>
          </div>
          <div><span className={label}>Fit preference</span>
            <div className="flex gap-1.5">
              {(["slim", "true", "oversized"] as const).map((f) => (
                <button type="button" key={f} onClick={() => setFitPref(fitPref === f ? "" : f)} className={chip(fitPref === f)}>
                  {f === "true" ? "true to size" : f}
                </button>
              ))}
            </div>
          </div>
          <div><span className={label}>
              Height{" "}
              <button type="button" className="underline" onClick={() => setHeightUnit(heightUnit === "cm" ? "ftin" : "cm")}>
                {heightUnit === "cm" ? "cm · switch to ft/in" : "ft/in · switch to cm"}
              </button></span>
            {heightUnit === "cm" ? (
              <input className={input} inputMode="decimal" placeholder="180" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            ) : (
              <div className="flex gap-2">
                <input className={input} inputMode="numeric" placeholder="5 ft" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
                <input className={input} inputMode="numeric" placeholder="11 in" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
              </div>
            )}
          </div>
          <div><span className={label}>
              Weight{" "}
              <button type="button" className="underline" onClick={() => setWeightUnit(weightUnit === "kg" ? "lbs" : "kg")}>
                {weightUnit} · switch to {weightUnit === "kg" ? "lbs" : "kg"}
              </button></span>
            <input className={input} inputMode="decimal" placeholder={weightUnit === "kg" ? "75" : "165"} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div><span className={label}>Jeans waist (inches)</span>
            <input className={input} inputMode="numeric" placeholder="32" value={jeans} onChange={(e) => setJeans(e.target.value)} /></div>
          <div><span className={label}>Shoe size</span>
            <div className="flex gap-2">
              <select className={input + " w-20"} value={shoeSystem} onChange={(e) => setShoeSystem(e.target.value as "us" | "eu")}>
                <option value="us">US</option><option value="eu">EU</option>
              </select>
              <input className={input} inputMode="decimal" placeholder={shoeSystem === "us" ? "9" : "42"} value={shoeVal} onChange={(e) => setShoeVal(e.target.value)} />
            </div>
          </div>
        </div>

        <details className="group mt-5 border-t border-neutral-100 pt-3">
          <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-neutral-500 hover:text-black">
            I know my measurements <span className="text-neutral-300 group-open:hidden">+</span>
            <span className="hidden text-neutral-300 group-open:inline">−</span>
          </summary>
          <p className="mt-2 text-[11px] text-neutral-400">
            These override the estimates — measure over a thin layer, tape snug but not tight.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><span className={label}>Chest (cm) — around the widest part</span>
              <input className={input} inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} /></div>
            <div><span className={label}>Shoulder (cm) — seam to seam across the back</span>
              <input className={input} inputMode="decimal" value={shoulder} onChange={(e) => setShoulder(e.target.value)} /></div>
            <div><span className={label}>Foot length (cm) — heel to longest toe</span>
              <input className={input} inputMode="decimal" value={foot} onChange={(e) => setFoot(e.target.value)} /></div>
          </div>
        </details>
      </section>

      <div className="space-y-3">
        <button onClick={() => submit(false)} disabled={pending}
          className="w-full bg-black py-2.5 text-[10px] uppercase tracking-widest text-white disabled:opacity-50">
          {pending ? "Saving…" : mode === "welcome" ? "Save & enter shop" : saved ? "Saved ✓" : "Save changes"}
        </button>
        {mode === "welcome" && (
          <button onClick={() => submit(true)} disabled={pending}
            className="block w-full text-center text-[10px] uppercase tracking-widest text-neutral-400 underline hover:text-black">
            Skip for now
          </button>
        )}
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Welcome page**

`web-v2/src/app/[handle]/welcome/page.tsx` (lives under the `[handle]` layout, so cookie auth already applies):

```tsx
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentFriend } from "@/lib/friend";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getCurrentFriend();
  // Admin previews and already-onboarded friends go straight to the shop.
  if (!friend || friend.handle !== handle) redirect(`/${handle}/shop`);

  const firstName = friend.name?.split(" ")[0] ?? "there";
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold tracking-tight">Hi {firstName} — welcome.</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        This is a small, invite-only shop of pieces that have been hunted down
        and quality-checked. Everything is ordered together in group hauls, so
        prices stay low and shipping is shared.
      </p>
      <div className="mt-10">
        <ProfileForm
          handle={handle}
          mode="welcome"
          initialAddress={friend.shipping_address}
          initialMeasurements={friend.measurements}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Invite route redirect**

In `web-v2/src/app/f/[token]/route.ts`, change the select to include `onboarded_at` and branch the redirect:

```ts
  const { data } = await sb
    .from("friends")
    .select("id, handle, onboarded_at")
    .eq("access_token", token)
    .eq("active", true)
    .maybeSingle();
```

and replace the `if (data.handle) redirect(...)` line with:

```ts
    if (data.handle) {
      redirect(
        data.onboarded_at ? `/${data.handle}/shop` : `/${data.handle}/welcome`,
      );
    }
```

- [ ] **Step 5: Lint + typecheck**

Run: `cd web-v2 && npx tsc --noEmit && npm run lint`
Expected: clean (lint may flag pre-existing issues only).

- [ ] **Step 6: Manual smoke test**

With the dev server running (`npm run dev` if not already): fetch a fresh-friend token from the DB (`select access_token, handle, onboarded_at from friends where handle='hampustest';` — reset with `update friends set onboarded_at=null where handle='hampustest';` first). Then `curl -s -o /dev/null -w "%{redirect_url}" http://localhost:3000/f/<token>` — expected redirect to `/hampustest/welcome`.

- [ ] **Step 7: Commit**

```bash
git add web-v2/src/app/[handle]/profile-actions.ts web-v2/src/components/ProfileForm.tsx "web-v2/src/app/[handle]/welcome" web-v2/src/app/f
git commit -m "feat(v2): welcome onboarding page + saveProfile action + invite redirect"
```

---

### Task 5: Profile page + header link

**Files:**
- Create: `web-v2/src/app/[handle]/profile/page.tsx`
- Modify: `web-v2/src/components/FriendHeader.tsx`

**Interfaces:**
- Consumes: `ProfileForm` (mode `"profile"`), `getCurrentFriend`.
- Produces: `/{handle}/profile` route — the target of every "Add your sizes" link (Task 6 uses `/${handle}/profile`).

- [ ] **Step 1: Profile page**

`web-v2/src/app/[handle]/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentFriend } from "@/lib/friend";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) redirect(`/${handle}/shop`);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold tracking-tight">Your profile</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Delivery address and sizing — used for your orders and size
        recommendations. Everything here is optional.
      </p>
      <div className="mt-8">
        <ProfileForm
          handle={handle}
          mode="profile"
          initialAddress={friend.shipping_address}
          initialMeasurements={friend.measurements}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Header link**

In `web-v2/src/components/FriendHeader.tsx`, inside the `<nav>` after the Haul link add:

```tsx
          <Link href={`/${handle}/profile`} className="hover:text-black">
            Profile
          </Link>
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd web-v2 && npx tsc --noEmit && npm run lint` — clean.

- [ ] **Step 4: Commit**

```bash
git add "web-v2/src/app/[handle]/profile" web-v2/src/components/FriendHeader.tsx
git commit -m "feat(v2): friend profile page + header link"
```

---

### Task 6: Product-page recommendation

**Files:**
- Modify: `web-v2/src/app/[handle]/product/[brand]/[code]/page.tsx`
- Modify: `web-v2/src/components/AddToHaul.tsx`

**Interfaces:**
- Consumes: `recommendSize`, `SizeRec` from `@/lib/sizing` (Task 3); `getCurrentFriend` (existing); `/{handle}/profile` route (Task 5).
- Produces: extended `AddToHaul` props — `recommended?: SizeRec | null`, `profileHref?: string | null`.

- [ ] **Step 1: Extend AddToHaul**

In `web-v2/src/components/AddToHaul.tsx`:

Props and preselection:

```tsx
import type { SizeRec } from "@/lib/sizing";

export function AddToHaul({
  handle,
  productId,
  sizes,
  recommended = null,
  profileHref = null,
}: {
  handle: string;
  productId: string;
  sizes: string[];
  recommended?: SizeRec | null;
  profileHref?: string | null;
}) {
  const [size, setSize] = useState<string | null>(
    recommended && sizes.includes(recommended.size)
      ? recommended.size
      : (sizes[0] ?? null),
  );
```

Directly under the size-button `<div className="flex flex-wrap ...">…</div>` block (still inside the `sizes.length > 0` conditional), add:

```tsx
          {recommended ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">
              Recommended: {recommended.reason}
            </p>
          ) : profileHref ? (
            <a href={profileHref} className="mt-1.5 block text-[10px] text-neutral-400 underline hover:text-black">
              Add your sizes for a recommendation →
            </a>
          ) : null}
```

- [ ] **Step 2: Compute in the product page**

In `web-v2/src/app/[handle]/product/[brand]/[code]/page.tsx`:

Add imports:

```tsx
import { getCurrentFriend } from "@/lib/friend";
import { recommendSize } from "@/lib/sizing";
```

After `const product = await getProductByCode(code);` (and its guards), add:

```tsx
  const friend = await getCurrentFriend();
  const hasProfile =
    friend?.measurements != null && Object.keys(friend.measurements).length > 0;
  const recommended = hasProfile
    ? recommendSize(friend!.measurements, product)
    : null;
```

and extend the `<AddToHaul …>` call:

```tsx
                <AddToHaul
                  handle={handle}
                  productId={product.id}
                  sizes={product.size_options ?? []}
                  recommended={recommended}
                  profileHref={
                    friend && !hasProfile ? `/${handle}/profile` : null
                  }
                />
```

(Admin preview → `friend` is null → no rec line and no prompt, by design.)

- [ ] **Step 3: Typecheck + lint + tests**

Run: `cd web-v2 && npx tsc --noEmit && npm run lint && npm test` — all clean/pass.

- [ ] **Step 4: Commit**

```bash
git add web-v2/src/components/AddToHaul.tsx "web-v2/src/app/[handle]/product"
git commit -m "feat(v2): size recommendation on product page (preselect + reason line)"
```

---

### Task 7: End-to-end browser verification

**Files:** none (verification only; fix anything found, then amend the relevant commit or add a fix commit).

**Interfaces:** consumes everything above.

- [ ] **Step 1: Reset the test friend**

MCP `execute_sql`: `update friends set onboarded_at = null, shipping_address = null, measurements = null where handle = 'hampustest' returning access_token;` — note the token.

- [ ] **Step 2: Welcome flow (Playwright MCP)**

Navigate to `http://localhost:3000/f/<token>`. Expected: land on `/hampustest/welcome`, greeting "Hi …", welcome copy visible, no "Hampus" anywhere in the copy.

- [ ] **Step 3: Fill + save**

Fill address (name "Test Friend", street, city, ZIP), set gender male, height 183 cm, weight 72 kg, jeans 31, shoe EU 41, fit "true to size". Click "Save & enter shop". Expected: land on `/hampustest/shop`. Verify with `execute_sql`: `select onboarded_at is not null, shipping_address->>'city', measurements->>'height_cm' from friends where handle='hampustest';`.

- [ ] **Step 4: Recommendation appears**

Open a product with a chest chart (e.g. the ERD Checkerboard Jacquard Shirt from the shop grid). Expected: a size is pre-selected and a "Recommended: … chart chest …cm vs your ~…cm" line renders under the size buttons. Open a bags/accessories product: no line. Open shoes: EU-based line.

- [ ] **Step 5: Re-entry + skip path**

Visit `/f/<token>` again → goes straight to `/hampustest/shop` (never welcome twice). Reset once more (`update friends set onboarded_at=null …`), open `/f/<token>`, click "Skip for now" → shop, and `onboarded_at` is stamped. Then visit `/hampustest/profile`, add measurements, save, and confirm the product page recommendation updates.

- [ ] **Step 6: Final check + commit any fixes**

Run: `cd web-v2 && npm test && npx tsc --noEmit && npm run lint`

```bash
git add -A && git commit -m "fix(v2): onboarding e2e polish" # only if fixes were needed
```
