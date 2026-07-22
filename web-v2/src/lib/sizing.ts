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
