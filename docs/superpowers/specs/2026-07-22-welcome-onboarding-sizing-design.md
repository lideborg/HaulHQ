# Welcome Onboarding + Size Recommendations — Design

**Date:** 2026-07-22
**Status:** Approved by Hampus (chat), pending spec review
**Scope:** web-v2 (Next.js 16 + Supabase, project ref `pqfiwdscftwhmcutspay`)

## Purpose

When a friend opens their invite link for the first time, greet them, collect a
shipping address, and optionally capture a sizing profile. Use that profile to
recommend a concrete size on every product page by matching estimated body
measurements against the product's scraped cm size chart (`products.size_guide`).
Rep sizing runs small and inconsistent; the letters (S/M/L) are noise — the
centimeters are truth.

## Existing plumbing (reuse, don't rebuild)

- `friends.shipping_address` (jsonb) — exists, empty today.
- `friends.measurements` (jsonb) — exists, empty today.
- Invite flow: `/f/<token>` sets `friend_token` cookie → redirects to `/{handle}/shop`.
- `products.size_guide` (jsonb) — per-size cm measurements from the import
  pipeline, e.g. `{unit:"cm", sizes:["S","M"], measurements:{chest:[108,112], length:[...], shoulder:[...]}}`.
- `products.size_options`, `products.category` — already populated.

## 1. Invite flow change

- **Migration:** add `friends.onboarded_at timestamptz null`.
- `/f/<token>` route: after setting the cookie, if the friend's `onboarded_at`
  is null redirect to `/{handle}/welcome`; otherwise `/{handle}/shop` as today.
- Both "Save & enter shop" and "Skip for now" set `onboarded_at = now()`.
  The welcome page never auto-appears again. All fields remain editable later
  on the profile page.

## 2. Welcome page — `/{handle}/welcome`

One scrollable screen, three blocks, one primary button. Everything skippable.

**Block A — welcome copy** (personalized `Hi {name}`):

> Hi {name} — welcome.
>
> This is a small, invite-only shop of pieces that have been hunted down and
> quality-checked. Everything is ordered together in group hauls, so prices
> stay low and shipping is shared.

(No mention of "Hampus" by name. Copy is a starting point; editable later.)

**Block B — delivery address** → `friends.shipping_address`:

Fields: full name, street, apt/unit, city, region/state, postal code, country,
phone. Intro line: "For easy delivery, enter your address and we'll save it for
your orders."

**Block C — sizing profile (marked "optional")** → `friends.measurements`:

Disclaimer copy at the top of the block:

> Sizing on these pieces can run a little off from what you're used to.
> Enter your details and we'll guide you to the most accurate size on every
> product. If you know your real measurements, even better — those win.

Fields (all optional, saved as filled):

| Field | Input | Notes |
|---|---|---|
| gender | male / female / prefer not to say | drives estimation + which size systems shown |
| height | number + cm ↔ ft-in toggle | stored as cm |
| weight | number + kg ↔ lbs toggle | stored as kg |
| jeans waist | inches (e.g. 32) | secretly a real measurement; +2" vanity offset at estimation time |
| shoe size | number + US ↔ EU picker | converted to foot-cm via standard tables (per gender) |
| fit preference | slim / true-to-size / oversized | shifts desired ease |
| **expander: "I know my measurements"** | chest cm, shoulder cm, foot length cm | each with a one-line how-to-measure hint; explicit values override estimates |

**Buttons:** primary "Save & enter shop"; quiet text link "Skip for now". Both
stamp `onboarded_at` and land on `/{handle}/shop`.

### measurements jsonb shape

```json
{
  "gender": "male",
  "height_cm": 180,
  "weight_kg": 75,
  "jeans_waist_in": 32,
  "shoe": { "system": "us", "value": 9 },
  "fit_pref": "true",
  "explicit": { "chest_cm": null, "shoulder_cm": null, "foot_cm": null }
}
```

### shipping_address jsonb shape

```json
{
  "name": "", "line1": "", "line2": "", "city": "",
  "region": "", "postal": "", "country": "US", "phone": ""
}
```

## 3. Profile page — `/{handle}/profile`

Same address + sizing fields, view/edit anytime, saves on submit. Linked from a
small profile icon in the shop header. All "Add your sizes" prompts link here.

## 4. Recommendation engine — product page only

Pure server-side function, computed live on every product page render. Nothing
precomputed or stored per user × product. Editing the profile instantly changes
all recommendations; new products need nothing beyond their imported chart.

```
recommendSize(measurements, product) -> { size, reason } | null
```

**Step 1 — estimate body dims** (skip any the user gave explicitly):
- chest cm from height + weight + gender (standard anthropometric approximation)
- waist cm from jeans size: `(jeans_waist_in + 2) * 2.54`
- foot cm from shoe size table (US/EU, per gender)

**Step 2 — match against `size_guide`** (unit cm), by category:
- tops / knitwear / hoodies / blazers / jackets / outerwear / shirts / t-shirts:
  primary = chest (garment chest − body chest = ease), secondary = shoulder
- pants / shorts: primary = waist
- shoes: foot cm vs the chart's foot-length row (or EU-size → cm table when the
  chart only lists EU sizes)

Desired ease by fit preference (tops): slim ≈ 4–8cm, true ≈ 8–14cm,
oversized ≈ 14cm+. Pick the size whose ease lands in-band; tie-break toward the
user's fit preference direction.

**Step 3 — output**: recommended size + a one-line human reason, e.g.
`"M — chart chest 112cm vs your ~104cm, relaxed fit"`.

**Fallbacks (no guessing):**
- Product has no `size_guide` → no recommendation shown.
- Friend has no profile / not enough fields → line reads
  "Add your sizes for a recommendation →" linking to `/{handle}/profile`.
- Recommended size sold out / absent from `size_options` → recommend nearest
  available and say so in the reason.

**UI on product page:** recommended size pre-selected in the size picker +
the one-line reason under it.

## 5. Testing

- Unit tests (vitest or node test runner, matching repo conventions) for:
  - shoe-size ↔ foot-cm tables (US/EU, men's/women's)
  - unit conversions (ft-in→cm, lbs→kg, jeans→waist-cm)
  - chest estimation sanity (known height/weight/gender fixtures)
  - chart matching incl. fit-pref shifts, tie-breaks, sold-out fallback,
    missing-chart and missing-profile nulls
- Manual browser pass (Playwright MCP): fresh token → welcome → save → shop;
  skip path; profile edit → product page recommendation updates.

## Out of scope (later)

- Shop-grid size badges and "my size" filter (option B/C — deferred).
- Auto-converting recommendations into order defaults.
- Women's-specific garment charts (few products today; engine is gender-aware
  already via estimation + shoe tables).
