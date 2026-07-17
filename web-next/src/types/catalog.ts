// Shapes pulled from data/<source>/*.json files.
// Liberal `unknown` and optional fields because the JSON files have evolved
// organically — only the columns we actually rely on are typed strictly.

export type Owner = "hampus" | "jan";
export type DataSource = "yupoo" | "superbuy" | "favorites" | "weidian" | "taobao" | "1688";
export type Category =
  | "apparel-top"
  | "apparel-bottom"
  | "eyewear"
  | "bag"
  | "shoes"
  | "accessory";

export type Acquisition = "superbuy" | "contact-seller";
export type ItemStatus = "favorite" | "purchased" | "warehouse" | "shipped";

export interface SizeChart {
  unit: "cm" | "in";
  sizes: string[];
  measurements: Record<string, Array<number | null>>;
  source_image?: string | null;
}

export interface Item {
  // Identity
  user_label: string;
  url?: string;
  source_url?: string | null;
  yupoo_url?: string | null;
  title?: string | null;
  title_translated?: string | null;
  description?: string | null;
  brand?: string | null;
  category?: Category | null;
  item_code?: string | null;
  model_code?: string | null;
  source?: DataSource | null;
  seller?: string | null;
  seller_id?: string | null;

  // Pricing
  price?: string | null;
  price_rmb?: string | null;
  price_usd?: string | null;
  price_usd_estimate?: string | null;
  quoted_by?: string | null;
  quoted_on?: string | null;

  // Sizing
  sizes?: string[];
  sizing?: string | null;
  size_chart?: SizeChart | null;
  needs_sizing_parse?: boolean;
  variants?: string[];
  target_variant?: string | null;
  target_size?: string | null;
  preferred_size?: string | null;

  // Images
  image_urls?: string[];
  detail_image_urls?: string[];
  local_image_paths?: string[];
  local_detail_image_paths?: string[];
  preview_photo_url?: string | null;

  // State
  status?: ItemStatus;
  owners?: Owner[];
  out_of_stock?: boolean;
  skipped?: boolean;
  skipped_reason?: string | null;
  locked?: boolean;
  requires_contact?: boolean;
  acquisition?: Acquisition | null;

  // Misc
  notes?: string | null;
  params?: Record<string, string>;

  // Synthesized at load time:
  _slug: string;
  _dir: DataSource;
}

export interface IndexEntry {
  user_label: string;
  file: string;
  url: string;
  title_translated?: string;
  image_count: number;
  brand?: string | null;
  category?: Category | null;
  item_code?: string | null;
  seller?: string | null;
  source?: DataSource;
  owners?: Owner[];
  price?: string | null;
  price_usd?: string | null;
  out_of_stock?: boolean;
  skipped?: boolean;
  locked?: boolean;
  requires_contact?: boolean;
  acquisition?: Acquisition;
  target_variant?: string | null;
  target_size?: string | null;
}

export interface CatalogIndex {
  scraped_at: string;
  total: number;
  entries: IndexEntry[];
}
