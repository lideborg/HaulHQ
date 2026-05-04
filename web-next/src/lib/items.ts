// Pure helpers usable in client OR server.

import type { Item } from "@/types/catalog";

const CNY_PER_USD = 6.83;

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

export function formatPrice(p: string | null | undefined): string {
  if (!p) return "—";
  const m = String(p).match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const cny = parseFloat(m[1]);
    const usd = Math.round(cny / CNY_PER_USD);
    return `${p}  ($${usd})`;
  }
  return p;
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
