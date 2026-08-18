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
// US Women's = men's number + 1.5 on the same foot ("us-w", or a legacy
// {system:"us"} row saved by a female friend). EU: (eu − 2) × 2⁄3.
export function shoeToFootCm(
  system: "us" | "us-w" | "eu",
  value: number,
  gender?: Measurements["gender"],
): number | null {
  if (!Number.isFinite(value)) return null;
  if (system === "eu") return r1(((value - 2) * 2) / 3);
  const menUs =
    system === "us-w" || (system === "us" && gender === "female")
      ? value - 1.5
      : value;
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

// Honest failure: we matched the chart and the friend's body falls outside the
// run this piece comes in. size:null tells the UI to show "we don't carry your
// size in this one" instead of a misleading nearest pick.
export interface NoFit {
  size: null;
  reason: string;
}

export type SizeAdvice = SizeRec | NoFit;

const TOP_CATS = new Set([
  "t-shirts", "shirts", "knitwear", "hoodies", "blazers", "jackets", "outerwear",
]);
const PANT_CATS = new Set(["pants", "shorts"]);

// Desired garment−body ease (cm) per fit preference, tops.
const EASE_MID = { slim: 6, true: 11, oversized: 18 } as const;

// A chart cell can be a stretch range like "78-90" — use its midpoint.
function cellToNumber(v: number | string | null): number {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  const nums = v.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length === 0) return NaN;
  return nums.length === 1 ? nums[0] : (nums[0] + nums[1]) / 2;
}

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
      const n = cellToNumber(v);
      if (Number.isNaN(n)) return NaN;
      let cm = n * toCm;
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

// Friend-facing copy for an out-of-range match. Keep it honest and specific.
const NO_FIT_COPY = "Looks like we don't carry your size in this one.";

export function recommendSize(
  m: Measurements | null,
  product: {
    category: string | null;
    size_options: string[];
    size_guide: SizeGuide | null;
  },
): SizeAdvice | null {
  if (!m) return null;
  const cat = product.category ?? "";

  if (cat === "shoes") {
    const foot = estimateFootCm(m);
    if (foot == null) return null;
    // Prefer an insole row; otherwise the EU size labels ARE the chart.
    const insole =
      product.size_guide ? chartRow(product.size_guide, { full: ["insole", "insole_length", "foot_length"], half: [] }, 0) : null;
    if (insole && product.size_guide) {
      // Want ~1cm of toe room over the bare foot (0.2–2.2cm acceptable).
      let best = -1;
      insole.forEach((v, i) => {
        if (Number.isNaN(v)) return;
        if (best === -1 || Math.abs(v - foot - 1) < Math.abs(insole[best] - foot - 1)) best = i;
      });
      if (best === -1) return null;
      const room = insole[best] - foot;
      if (room < 0.2 || room > 2.2) {
        const dir = room < 0.2 ? "largest size is still too small" : "smallest size is still too big";
        return { size: null, reason: `${NO_FIT_COPY} The ${dir} for your ~${foot}cm foot (closest insole is ${r1(insole[best])}cm).` };
      }
      const size = product.size_guide.sizes[best];
      return { size, reason: `This ${size} has a ${r1(insole[best])}cm insole against your ~${foot}cm foot.` };
    }
    const eus = product.size_options
      .map((label) => ({ label, cm: euFromLabel(label) != null ? shoeToFootCm("eu", euFromLabel(label)!) : null }))
      .filter((e): e is { label: string; cm: number } => e.cm != null);
    if (eus.length === 0) return null;
    const best = eus.reduce((a, b) =>
      Math.abs(b.cm - foot) < Math.abs(a.cm - foot) ? b : a);
    // More than ~one EU size (0.67cm) off at the end of the run = out of range.
    if (Math.abs(best.cm - foot) > 0.75) {
      const dir = best.cm < foot ? "biggest size runs smaller than" : "smallest size runs bigger than";
      return { size: null, reason: `${NO_FIT_COPY} The ${dir} your ~${foot}cm foot (closest is EU ${best.label} at ~${best.cm}cm).` };
    }
    return { size: best.label, reason: `EU ${best.label} runs about ${best.cm}cm against your ~${foot}cm foot.` };
  }

  // Belts (and any accessory sized by waist): the size labels are US pant/jeans
  // sizes ("30-33") or plain numbers, so match the friend's jeans size directly
  // (a measured waist in cm is the fallback). No size chart needed. estimateWaistCm
  // is NOT used — it returns a garment waist with vanity ease that would inflate it.
  if (cat === "accessories") {
    const waistIn =
      m.jeans_waist_in ??
      (m.explicit?.waist_cm != null ? r1(m.explicit.waist_cm / 2.54) : null);
    if (waistIn == null) return null;
    const opts = product.size_options
      .map((label) => {
        const range = label.match(/^\s*(\d+(?:\.\d)?)\s*[-–]\s*(\d+(?:\.\d)?)\s*$/);
        if (range) {
          const lo = +range[1];
          const hi = +range[2];
          return { label, lo, hi, mid: (lo + hi) / 2 };
        }
        const one = label.match(/^\s*(\d+(?:\.\d)?)\s*$/);
        if (one) return { label, lo: +one[1], hi: +one[1], mid: +one[1] };
        return null;
      })
      .filter(
        (o): o is { label: string; lo: number; hi: number; mid: number } => o != null,
      );
    if (opts.length === 0) return null; // caps, gloves, jewellery — not waist-sized
    const hit = opts.find((o) => waistIn >= o.lo && waistIn <= o.hi);
    const picked =
      hit ??
      opts.reduce((a, b) =>
        Math.abs(b.mid - waistIn) < Math.abs(a.mid - waistIn) ? b : a,
      );
    // No exact range hit and the nearest range is >1.5in away = out of the run.
    if (!hit && (waistIn < picked.lo - 1.5 || waistIn > picked.hi + 1.5)) {
      return { size: null, reason: `${NO_FIT_COPY} The sizes run ${opts[0].label}–${opts[opts.length - 1].label} against your ~${waistIn}in waist.` };
    }
    return { size: picked.label, reason: `${picked.label} matches your ~${waistIn}in waist.` };
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
    // Under ~2cm of ease it won't close comfortably; way past the preferred
    // ease band it hangs like a tent. Either way, say so instead of guessing.
    if (ease < 2 || ease > mid + 12) {
      const dir =
        ease < 2
          ? `the largest size measures chest ${r1(chest[guide.sizes.indexOf(picked.size)])}cm against your ~${body}cm`
          : `the smallest size measures chest ${r1(chest[guide.sizes.indexOf(picked.size)])}cm against your ~${body}cm`;
      return { size: null, reason: `${NO_FIT_COPY} On the chart ${dir}.` };
    }
    const feel = ease < 4 ? "a snug fit" : ease > 14 ? "a relaxed fit" : "a regular fit";
    const chartCm = r1(chest[guide.sizes.indexOf(picked.size)]);
    const note = picked.fallback ? " (closest available)" : "";
    return {
      size: picked.size,
      reason: `This ${picked.size} measures chest ${chartCm}cm against your ~${body}cm, so expect ${feel}${note}. Sizes here follow the chart, not the label.`,
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
    const ease = waist[guide.sizes.indexOf(picked.size)] - body;
    // Below −1cm it won't button; past +8cm it slides off even with a belt.
    if (ease < -1 || ease > 8) {
      const dir = ease < -1 ? "largest" : "smallest";
      return { size: null, reason: `${NO_FIT_COPY} The ${dir} size measures waist ${chartCm}cm against your ~${body}cm.` };
    }
    const note = picked.fallback ? " (closest available)" : "";
    return {
      size: picked.size,
      reason: `This ${picked.size} measures waist ${chartCm}cm against your ~${body}cm${note}.`,
    };
  }

  return null; // bags / other accessories / glasses: no sizing
}
