// Pure rendering logic for per-seller "Copy message" buttons. Picks a
// template from data/notes/seller-messages.json by matching a substring
// of item.seller against template.seller_name_pattern, then substitutes
// the {{token}} placeholders for each item.
//
// Server pre-loads the JSON and passes it as a prop; this file handles
// the logic so it works in both server + client without duplication.

import type { Item } from "@/types/catalog";
import type { SellerMessageTemplate, SellerMessagesFile } from "@/types/notes";

const TOKENS = {
  user_label: (it: Item) => it.user_label ?? "",
  url: (it: Item) => it.url ?? "",
  item_code: (it: Item) => it.item_code ?? "",
  // Padded — fixed-width "#XXXXXX " or "" if no code, useful for vertical alignment.
  item_code_pad: (it: Item) =>
    it.item_code ? `#${it.item_code}`.padEnd(8, " ") + " " : "",
  // Surrounded — " (color)" or " #SL572"; collapses to "" when empty.
  variant_paren: (it: Item) =>
    it.target_variant ? ` (${it.target_variant})` : "",
  item_code_paren: (it: Item) => (it.item_code ? ` #${it.item_code}` : ""),
  size: (it: Item) => it.target_size ?? "",
  photo_url: () => "",
};

function fillTemplate(line: string, item: Item): string {
  return line.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const fn = TOKENS[key as keyof typeof TOKENS];
    return fn ? fn(item) : "";
  });
}

export function pickTemplate(
  templates: SellerMessageTemplate[],
  sellerName: string | null | undefined
): SellerMessageTemplate {
  const haystack = (sellerName ?? "").toLowerCase();
  for (const t of templates) {
    if (!t.seller_name_pattern) continue; // skip default until we've checked others
    if (haystack.includes(t.seller_name_pattern.toLowerCase())) return t;
  }
  return templates.find((t) => t.key === "default") ?? templates[templates.length - 1];
}

// Group wishlist items by which template they'd use, so the Haul tab can
// render one "Copy message for X" button per actual sender. Items with
// blank seller share the default bucket.
export interface SellerBucket {
  template: SellerMessageTemplate;
  items: Item[];
}

export function bucketBySeller(
  items: Item[],
  data: SellerMessagesFile
): SellerBucket[] {
  const buckets = new Map<string, SellerBucket>();
  for (const it of items) {
    const t = pickTemplate(data.templates, it.seller);
    const cur = buckets.get(t.key) ?? { template: t, items: [] };
    cur.items.push(it);
    buckets.set(t.key, cur);
  }
  // Sort by item count desc so the biggest target seller surfaces first.
  return [...buckets.values()].sort((a, b) => b.items.length - a.items.length);
}

export function renderMessage(bucket: SellerBucket): string {
  const lines = bucket.items.map((it) => fillTemplate(bucket.template.line_format, it));
  return [bucket.template.intro, ...lines, bucket.template.closing]
    .filter((s) => s.length > 0)
    .join("\n");
}
