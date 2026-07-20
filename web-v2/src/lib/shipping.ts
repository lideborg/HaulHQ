// Shipping estimate for a haul, anchored to the EMS Preferential Line USA
// tiers Hampus actually ships on (validated against paid parcels: ~10 kg /
// $214, ~7-8 kg / $178). Estimates carry ±15% spread and a 20% service margin
// on top — same margin as items.

// [kg, USD] anchor points (data/shipping-data.json, May 2026 snapshot).
const EMS_TIERS: Array<[number, number]> = [
  [1, 45], [4, 111], [7, 165], [10, 220], [12, 255], [15, 305], [20, 395],
];

const SPREAD = 0.15; // quoted range around the interpolated rate
const MARGIN = 1.2; // our 20% on shipping
const PACKAGING = 1.08; // consolidation wrap adds ~8% over summed item weights

export interface ShippingEstimate {
  chargeableKg: number; // billed weight: items + packaging, rounded up to 0.5 kg
  lowUsd: number;
  highUsd: number;
}

function interpolate(kg: number): number {
  const t = EMS_TIERS;
  if (kg <= t[0][0]) return t[0][1]; // postal minimum: below 1 kg bills as 1 kg
  for (let i = 1; i < t.length; i++) {
    if (kg <= t[i][0]) {
      const [k0, p0] = t[i - 1];
      const [k1, p1] = t[i];
      return p0 + ((kg - k0) / (k1 - k0)) * (p1 - p0);
    }
  }
  // beyond the last tier: extend at the last segment's per-kg rate
  const [k0, p0] = t[t.length - 2];
  const [k1, p1] = t[t.length - 1];
  return p1 + (kg - k1) * ((p1 - p0) / (k1 - k0));
}

export function estimateShipping(totalItemGrams: number): ShippingEstimate | null {
  if (totalItemGrams <= 0) return null;
  const chargeableKg = Math.ceil((totalItemGrams * PACKAGING) / 500) / 2; // → 0.5 kg steps
  const base = interpolate(chargeableKg) * MARGIN;
  return {
    chargeableKg,
    lowUsd: Math.round(base * (1 - SPREAD)),
    highUsd: Math.round(base * (1 + SPREAD)),
  };
}
