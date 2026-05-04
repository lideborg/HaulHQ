// Shipping calculator. Pure functions over ShippingData; safe in client OR server.
// Server-side helper to load the raw JSON lives in shipping.server.ts.

import type {
  ShipCalcInput,
  ShipCalcResult,
  ShippingData,
  ShippingLine,
  WeightProfile,
} from "@/types/shipping";

const PROFILE_INDEX: Record<WeightProfile, 0 | 1 | 2> = {
  low: 0,
  typical: 1,
  high: 2,
};

function categoryKey(data: ShippingData, raw: string | null | undefined): string {
  const cat = (raw ?? "").toLowerCase();
  if (cat in data.category_aliases) return data.category_aliases[cat];
  if (cat in data.weights) return cat;
  return "_default";
}

function weightFor(
  data: ShippingData,
  raw: string | null | undefined,
  profile: WeightProfile
): { kg: number; mult: number } {
  const key = categoryKey(data, raw);
  const row = data.weights[key] ?? data.weights._default;
  return { kg: row[PROFILE_INDEX[profile]], mult: row[3] };
}

function tariffRate(data: ShippingData, raw: string | null | undefined): number {
  const key = categoryKey(data, raw);
  return (data.tariffs[key] ?? data.tariffs._default).rate;
}

export function estimateWeight(
  data: ShippingData,
  categories: Array<string | null | undefined>,
  profile: WeightProfile = "typical"
): { actual: number; charged: number } {
  let actual = 0;
  let charged = 0;
  for (const cat of categories) {
    const { kg, mult } = weightFor(data, cat, profile);
    actual += kg;
    charged += kg * mult;
  }
  return { actual, charged };
}

export function interpolateRate(line: ShippingLine, kg: number): number {
  const tiers = Object.entries(line.tiers)
    .map(([k, v]) => [parseFloat(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const billable = Math.max(kg, line.min_kg ?? 0);
  if (billable <= tiers[0][0]) {
    return tiers[0][1] * (billable / tiers[0][0]);
  }
  for (let i = 0; i < tiers.length - 1; i++) {
    const [w1, p1] = tiers[i];
    const [w2, p2] = tiers[i + 1];
    if (billable >= w1 && billable <= w2) {
      const frac = (billable - w1) / (w2 - w1);
      return p1 + frac * (p2 - p1);
    }
  }
  const [w1, p1] = tiers[tiers.length - 2];
  const [w2, p2] = tiers[tiers.length - 1];
  const slope = (p2 - p1) / (w2 - w1);
  return p2 + slope * (billable - w2);
}

export function calc(data: ShippingData, input: ShipCalcInput): ShipCalcResult {
  const profile = input.weightProfile ?? "typical";
  const declaredPct = input.declaredPct ?? 0.1;
  const line =
    data.lines.find((l) => l.id === input.lineId) ?? data.lines[0];

  const w = estimateWeight(data, input.itemCategories, profile);
  const billableKg = input.weightOverrideKg ?? w.charged;
  const baseShipping = interpolateRate(line, billableKg);
  const fees =
    baseShipping * (data.fees.superbuy_payment_pct ?? 0) +
    (data.fees.agent_handling_per_parcel_usd ?? 0);

  const cnyPerUsd = data._meta.currency_assumptions.cny_per_usd || 6.83;
  const itemsUsd = input.itemsCny / cnyPerUsd;
  const declaredUsd = itemsUsd * declaredPct;

  let duty = 0;
  if (line.tariff_handling === "recipient" && input.itemsCny > 0) {
    // Blended rate weighted by category share. Without per-item subtotals
    // we approximate by treating each item's weight as its tariff weight.
    let weightedRate = 0;
    let totalKg = 0;
    for (const cat of input.itemCategories) {
      const { kg, mult } = weightFor(data, cat, profile);
      const c = kg * mult;
      totalKg += c;
      weightedRate += c * tariffRate(data, cat);
    }
    if (totalKg > 0) duty = declaredUsd * (weightedRate / totalKg);
  }

  return {
    line,
    actualKg: w.actual,
    chargedKg: w.charged,
    billableKg,
    baseShipping,
    fees,
    itemsUsd,
    declaredUsd,
    duty,
    totalUsd: itemsUsd + baseShipping + fees + duty,
  };
}
