// Shipping estimate for a haul, calibrated to Admin's real EMS Preferential
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
const MARGIN = 1.2; // Admin's 20% on shipping (same as items)
const SPREAD = 0.12; // quoted range; also absorbs dense-vs-bulky variance

export interface ShippingEstimate {
  chargeableKg: number; // billed weight (items + packaging, rounded up to 0.5 kg)
  lowUsd: number;
  highUsd: number;
}

// The receipt calibration above is US-only. Other destinations scale off it:
// Sweden/EU ≈ 1.3, derived from Henke's real Sweden quote (~$270) vs what the
// US model gives for the same weight (~$205). Replace with a receipt-based
// calibration per lane once real non-US parcels ship.
const INTL_FACTOR = 1.3;

// Profile addresses store country as free text ("Sweden", "SWEDEN", "US",
// "United States") — the friend typed it. Treat anything that isn't clearly
// the US as an international lane.
export function isUsDestination(raw?: string | null): boolean {
  const s = (raw ?? "").trim().toUpperCase();
  return s === "" || s === "US" || s === "USA" || s.startsWith("UNITED STATES");
}

export function estimateShipping(
  totalItemGrams: number,
  country?: string | null,
): ShippingEstimate | null {
  if (totalItemGrams <= 0) return null;
  const units = Math.ceil((totalItemGrams * PACKAGING) / STEP_G); // 0.5 kg units, ≥1
  const fee = EMS_FIRST + EMS_ADDL * (units - 1) + HANDLING;
  const factor = isUsDestination(country) ? 1 : INTL_FACTOR;
  const withMargin = fee * MARGIN * factor;
  return {
    chargeableKg: units * 0.5,
    lowUsd: Math.round(withMargin * (1 - SPREAD)),
    highUsd: Math.round(withMargin * (1 + SPREAD)),
  };
}

// Human label for the cart's "Est. shipping (EMS to Sweden)" line. Accepts an
// ISO code ("SE") or the free-text country the friend typed ("SWEDEN").
export function destinationName(country?: string | null): string | null {
  const raw = (country ?? "").trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(
        raw.toUpperCase(),
      );
      // Intl returns the input itself for unassigned codes — treat as unknown.
      return name && name !== raw.toUpperCase() ? name : null;
    } catch {
      return null;
    }
  }
  if (!/[A-Za-z]/.test(raw)) return null;
  // Free text: title-case it ("SWEDEN" → "Sweden").
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
