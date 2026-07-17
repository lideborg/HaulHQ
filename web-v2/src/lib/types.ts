export interface Product {
  id: string;
  brand: string | null;
  title: string;
  description: string | null;
  category: string | null;
  seller: string | null;
  source_link: string | null;
  image_urls: string[];
  cost_cny: number | null;
  markup: number;
  price_usd: number | null;
  size_options: string[];
  published: boolean;
  created_at: string;
}

export interface Friend {
  id: string;
  name: string;
  email: string | null;
  access_token: string;
  shipping_address: Record<string, unknown> | null;
  currency: string;
  is_admin: boolean;
  active: boolean;
}

export interface Seller {
  id: string;
  name: string;
  brands: string[];
  yupoo_url: string | null;
  superbuy_store: string | null;
  notes: string | null;
}
