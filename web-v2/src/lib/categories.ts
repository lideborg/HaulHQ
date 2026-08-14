// Single source of truth for product categories.
// Stored value on products.category is the SLUG; UI renders the LABEL.
export const CATEGORIES = [
  { slug: "t-shirts", label: "T-Shirts" },
  { slug: "shirts", label: "Shirts" },
  { slug: "knitwear", label: "Knitted" },
  { slug: "hoodies", label: "Hoodies & Long Sleeves" },
  { slug: "blazers", label: "Blazers" },
  { slug: "jackets", label: "Jackets" },
  { slug: "outerwear", label: "Coats" },
  { slug: "pants", label: "Pants" },
  { slug: "shorts", label: "Shorts" },
  { slug: "shoes", label: "Shoes" },
  { slug: "bags", label: "Bags" },
  { slug: "hats", label: "Hats" },
  { slug: "accessories", label: "Accessories" },
  { slug: "glasses", label: "Glasses" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS: readonly string[] = CATEGORIES.map((c) => c.slug);

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
);

// Canonical display/sort order (index in CATEGORIES).
export const CATEGORY_ORDER: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c.slug, i]),
);
