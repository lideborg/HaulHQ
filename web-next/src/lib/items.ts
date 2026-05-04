// Pure helpers usable in client OR server.

import type { Item } from "@/types/catalog";

// Single source of truth for the CNY → USD conversion rate.
// Keep in sync with data/shipping-data.json:_meta.currency_assumptions.cny_per_usd.
// Phase 2 will pull this from the shipping-data row instead of a constant.
export const CNY_PER_USD = 6.83;

export function imagesOf(item: Item): string[] {
  if (item.local_image_paths?.length) {
    return item.local_image_paths.map((p) => `/data/${item._dir}/${p}`);
  }
  return item.image_urls ?? [];
}

export function priceCny(item: Pick<Item, "price">): number {
  if (!item.price) return 0;
  const m = String(item.price).match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

// Prefer the stored price_usd if the item has one (more accurate — set at
// scrape time from the seller's actual quote). Fall back to converting
// price_cny via CNY_PER_USD.
export function priceUsd(item: Pick<Item, "price" | "price_usd">): number {
  if (item.price_usd) {
    const m = String(item.price_usd).match(/\$\s*(\d+(?:\.\d+)?)/);
    if (m) return parseFloat(m[1]);
  }
  return priceCny(item) / CNY_PER_USD;
}

export function formatPrice(item: Pick<Item, "price" | "price_usd">): string {
  if (!item.price) return "—";
  const cny = priceCny(item);
  if (cny === 0) return item.price;
  const usd = Math.round(priceUsd(item));
  return `${item.price}  ($${usd})`;
}

export function categoryLabel(c: string | null | undefined): string {
  return (
    {
      "apparel-top": "Apparel",
      "apparel-bottom": "Apparel",
      eyewear: "Eyewear",
      bag: "Bag",
      shoes: "Shoes",
      accessory: "Accessory",
    } as Record<string, string>
  )[c ?? ""] || c || "All";
}

export function itemKey(item: Item): string {
  return `${item._dir}|${item.user_label}|${item.url ?? ""}`;
}

// Yupoo seller listings paste the same factory-pricing marketing blurb
// onto every item description. It adds noise to the modal without saying
// anything about the product. Strip it (and the trailing emojis / link
// glyphs) so what's left is the actually-useful detail.
const YUPOO_BOILERPLATE_PATTERNS: RegExp[] = [
  /Direct factory pricing[^\.]*\.\s*Stop overpaying!\s*Contact us for factory price[^\.]*\.\s*/i,
  /Direct factory pricing[^.]*$/i,
  /🔗\s*$/u,
  /\s*Category:\s*[^.]+\.\s*$/i,
];

export function cleanDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw);
  for (const re of YUPOO_BOILERPLATE_PATTERNS) s = s.replace(re, "");
  return s.trim();
}
