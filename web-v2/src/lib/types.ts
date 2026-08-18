export interface SizeGuide {
  unit: "cm" | "in";
  note?: string;
  sizes: string[];
  // Values are usually numbers in `unit`, but a cell can be a string when the
  // chart gives a stretch range (e.g. an elastic waist "78-90").
  measurements: Record<string, (number | string | null)[]>;
}

// One entry per image, aligned 1:1 with Product.image_urls (hero first).
// Written by scripts/retag-heroes.mjs; null on a product = not yet tagged.
export interface ImageMeta {
  url: string;
  kind: "flat_lay" | "front" | "worn" | "detail" | "size_chart" | "logo_text" | "other";
  hero: boolean;
}

export interface Product {
  id: string;
  brand: string | null;
  title: string;
  // Short card name "[Color] [Material?] [Garment]" (<= 4 words); `title`
  // keeps the full scraped description.
  display_title: string | null;
  description: string | null;
  category: string | null;
  // Normalized colour family (12 slugs) for the shop colour filter.
  color: string | null;
  code: string | null;
  brand_slug: string | null;
  seller: string | null;
  source_link: string | null;
  image_urls: string[];
  cost_cny: number | null;
  markup: number;
  price_usd: number | null;
  size_options: string[];
  published: boolean;
  created_at: string;
  size_guide: SizeGuide | null;
  admin_sizing_note: string | null;
  source_platform: string | null;
  colors: string[];
  sold_out: boolean;
  yupoo_url: string | null;
  image_meta: ImageMeta[] | null;
}

export interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  phone?: string;
}

// All fields optional; friends fill in as much as they want.
export interface Measurements {
  gender?: "male" | "female" | "na";
  height_cm?: number;
  weight_kg?: number;
  jeans_waist_in?: number;
  // "us" is US Men's; "us-w" is US Women's (same foot, number runs 1.5 higher).
  // Legacy rows may hold {system:"us"} for a female friend — shoeToFootCm still
  // applies the gender offset for those.
  shoe?: { system: "us" | "us-w" | "eu"; value: number };
  fit_pref?: "slim" | "true" | "oversized";
  // Explicit tape-measure values; when present they override estimates.
  explicit?: { chest_cm?: number; waist_cm?: number; shoulder_cm?: number; foot_cm?: number };
}

export interface Friend {
  id: string;
  name: string;
  handle: string | null;
  // Optional — collected at haul approval so admin can email order updates.
  email: string | null;
  password_hash: string | null;
  setup_token: string | null;
  access_token: string;
  shipping_address: ShippingAddress | null;
  currency: string;
  is_admin: boolean;
  active: boolean;
  measurements: Measurements | null;
  onboarded_at: string | null;
}

// A numbered batch of items ("Haul 01"). A friend has at most one open haul
// (the one they're building); approving closes it and the next add starts
// the next number.
export interface Haul {
  id: string;
  owner_id: string;
  number: number;
  status: "open" | "approved";
  approved_at: string | null;
  created_at: string;
}

export interface HaulItem {
  id: string;
  owner_id: string;
  haul_id: string | null;
  product_id: string | null;
  // Embedded live product (from getHaul's join); null for link-only requests.
  products?: {
    weight_g: number | null;
    display_title: string | null;
    brand_slug: string | null;
    code: string | null;
  } | null;
  title: string | null;
  brand: string | null;
  image_urls: string[] | null;
  chosen_size: string | null;
  quantity: number;
  quoted_price_usd: number | null;
  status: string | null;
  source_link: string | null;
  notes: string | null;
  to_source: boolean;
  admin_note: string | null;
  sourcing_note: string | null;
  created_at: string;
}

export interface Seller {
  id: string;
  name: string;
  brands: string[];
  yupoo_url: string | null;
  superbuy_store: string | null;
  notes: string | null;
}
