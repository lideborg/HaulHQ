// Shipping estimate for a haul, calibrated to Hampus's real EMS Preferential
// Line-XN parcels to the US (Superbuy parcel receipts, Jun–Jul 2026):
//   9020 g → $214.21 · 6825 g → $178.48 · 11640 g → $287.70 · 12345 g → $297.49
// The receipts show the exact rate: 1st 0.5 kg = $35.15, each additional
// 0.5 kg = $9.27, + ~$6 clearance/tax, billed by 0.5 kg (rounded up), with
// volumetric/box padding on bulky parcels.

const EMS_FIRST = 35.15; // first 0.5 kg
const EMS_ADDL = 9.27; // each additional 0.5 kg
const HANDLING = 6; // customs clearance + typical tax + protector/vacuum
const STEP_G = 500; // billed in 0.5 kg increments

// Friends' hauls are summed ITEM weights; a real parcel is heavier (box) and
// often volumetric-billed. This factor bridges summed-items → billed weight so
// the midpoint lands at (or slightly above) what the parcel actually costs.
const PACKAGING = 1.18;
const MARGIN = 1.2; // Hampus's 20% on shipping (same as items)
const SPREAD = 0.12; // quoted range; also absorbs dense-vs-bulky variance

export interface ShippingEstimate {
  chargeableKg: number; // billed weight (items + packaging, rounded up to 0.5 kg)
  lowUsd: number;
  highUsd: number;
}

export function estimateShipping(totalItemGrams: number): ShippingEstimate | null {
  if (totalItemGrams <= 0) return null;
  const units = Math.ceil((totalItemGrams * PACKAGING) / STEP_G); // 0.5 kg units, ≥1
  const fee = EMS_FIRST + EMS_ADDL * (units - 1) + HANDLING;
  const withMargin = fee * MARGIN;
  return {
    chargeableKg: units * 0.5,
    lowUsd: Math.round(withMargin * (1 - SPREAD)),
    highUsd: Math.round(withMargin * (1 + SPREAD)),
  };
}
