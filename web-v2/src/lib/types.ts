export interface SizeGuide {
  unit: "cm" | "in";
  note?: string;
  sizes: string[];
  measurements: Record<string, (number | null)[]>;
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

export interface Friend {
  id: string;
  name: string;
  handle: string | null;
  email: string | null;
  access_token: string;
  shipping_address: Record<string, unknown> | null;
  currency: string;
  is_admin: boolean;
  active: boolean;
  measurements: Record<string, number> | null;
}

export interface HaulItem {
  id: string;
  owner_id: string;
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
  quoted_price_usd: number | null;
  status: string | null;
  source_link: string | null;
  notes: string | null;
  to_source: boolean;
  admin_note: string | null;
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
