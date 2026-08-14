// Single source of truth for shop color-family filtering.
// products.color stores the SLUG; the shop filter renders the swatch + label.
// normalizeColor() folds the free-text colour (from display_title "— Colour")
// into one of 12 families. Mirrors the categories.ts pattern.
export const COLOR_FAMILIES = [
  { slug: "black", label: "Black", swatch: "#111111", order: 0 },
  { slug: "white", label: "White & Cream", swatch: "#efe9dc", order: 1 },
  { slug: "grey", label: "Grey", swatch: "#8c8c8c", order: 2 },
  { slug: "blue", label: "Blue", swatch: "#3a5a95", order: 3 },
  { slug: "brown", label: "Brown", swatch: "#6b4a2f", order: 4 },
  { slug: "beige", label: "Beige & Tan", swatch: "#cbb891", order: 5 },
  { slug: "green", label: "Green", swatch: "#4b6b3f", order: 6 },
  { slug: "red", label: "Red & Burgundy", swatch: "#7c2430", order: 7 },
  { slug: "yellow", label: "Yellow & Gold", swatch: "#c9a227", order: 8 },
  { slug: "purple", label: "Purple", swatch: "#6a4a8a", order: 9 },
  { slug: "pink", label: "Pink", swatch: "#d99fb0", order: 10 },
  { slug: "multi", label: "Multi / Print", swatch: "conic", order: 11 },
] as const;

export type ColorSlug = (typeof COLOR_FAMILIES)[number]["slug"];

export const COLOR_SLUGS: readonly string[] = COLOR_FAMILIES.map((f) => f.slug);
export const COLOR_LABEL: Record<string, string> = Object.fromEntries(
  COLOR_FAMILIES.map((f) => [f.slug, f.label]),
);

// Ordered keyword table. First family whose keyword appears in the (lowercased)
// string wins. Two-tone / slashed / patterned strings short-circuit to "multi".
const FAMILY_KEYWORDS: [Exclude<ColorSlug, "multi">, string[]][] = [
  ["black", ["black", "ebony", "jet"]],
  ["white", ["white", "cream", "ivory", "oatmeal", "ecru", "milky"]],
  ["grey", ["grey", "gray", "charcoal", "heather", "slate", "cement", "cloud", "elephant"]],
  ["blue", ["blue", "navy", "indigo", "denim", "sky", "aqua", "haze", "dusty", "smoky", "ink", "royal", "cobalt"]],
  ["brown", ["brown", "coffee", "mocha", "cognac", "taupe", "camel", "caramel", "chocolate", "tortoise"]],
  ["beige", ["beige", "tan", "khaki", "sand", "apricot", "natural", "oat", "nude"]],
  ["green", ["green", "olive", "army", "forest", "sage", "matcha", "moss"]],
  ["red", ["red", "burgundy", "wine", "maroon", "crimson"]],
  ["yellow", ["yellow", "gold", "mustard", "amber"]],
  ["purple", ["purple", "violet", "lilac"]],
  ["pink", ["pink", "rose", "blush"]],
];

const MULTI_WORDS = ["multi", "camo", "camouflage", "flag", "print", "plaid", "check", "clear", "silver"];

export function normalizeColor(raw: string): ColorSlug {
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (!s) return "multi";
  if (s.includes("/") || s.includes("&") || s.includes(" and ")) return "multi";
  if (MULTI_WORDS.some((w) => s.includes(w))) return "multi";
  for (const [slug, kws] of FAMILY_KEYWORDS) {
    if (kws.some((k) => s.includes(k))) return slug;
  }
  return "multi";
}
