// Mirrors web-next/public/data/../../web/shipping-data.json structure.

export type TariffHandling = "tariffless" | "ddp" | "recipient";

export interface ShippingLine {
  id: string;
  label: string;
  agent: string;
  transit_days: [number, number];
  brands_ok: boolean | "grey";
  min_kg: number | null;
  volumetric_divisor: number | null;
  tariff_handling: TariffHandling;
  deposit_pct?: number;
  tiers: Record<string, number>;
}

export interface TariffEntry {
  rate: number;
  hts: string;
  label: string;
}

export interface ShippingData {
  _meta: {
    compiled: string;
    currency_assumptions: { cny_per_usd: number };
    notes: string;
  };
  lines: ShippingLine[];
  weights: Record<string, [number, number, number, number] | undefined> & {
    _columns?: string[];
    _default: [number, number, number, number];
  };
  tariffs: Record<string, TariffEntry | undefined> & {
    _note?: string;
    _default: TariffEntry;
  };
  category_aliases: Record<string, string>;
  fees: {
    superbuy_payment_pct: number;
    agent_handling_per_parcel_usd: number;
    _note?: string;
  };
}

export type WeightProfile = "low" | "typical" | "high";

export interface ShipCalcInput {
  itemsCny: number;
  itemCategories: Array<string | null | undefined>;
  lineId: string;
  weightProfile?: WeightProfile;
  declaredPct?: number;
  weightOverrideKg?: number | null;
}

export interface ShipCalcResult {
  line: ShippingLine;
  actualKg: number;
  chargedKg: number;
  billableKg: number;
  baseShipping: number;
  fees: number;
  itemsUsd: number;
  declaredUsd: number;
  duty: number;
  totalUsd: number;
}
