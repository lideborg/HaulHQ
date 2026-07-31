// Pure sizing math — no framework imports, unit-tested with node --test.
// All outputs cm, rounded to 0.1. Estimation is deliberately simple linear
// anthropometry: good to ±one size, which is all chart-matching needs.
import type { Measurements, SizeGuide } from "./types";

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
  // A measured waist is exact; a jeans size is a vanity-sized proxy.
  if (m.explicit?.waist_cm) return r1(m.explicit.waist_cm);
  if (m.jeans_waist_in) return jeansWaistToCm(m.jeans_waist_in);
  return null;
}

export function estimateFootCm(m: Measurements): number | null {
  if (m.explicit?.foot_cm) return r1(m.explicit.foot_cm);
  if (m.shoe) return shoeToFootCm(m.shoe.system, m.shoe.value, m.gender);
  return null;
}

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
