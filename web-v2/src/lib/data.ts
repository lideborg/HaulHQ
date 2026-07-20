import { createAdminClient } from "./supabase/admin";
import type { Product, Seller, Friend, HaulItem } from "./types";
import { CATEGORY_ORDER } from "./categories";

// Server-only reads (service role). Friends only ever see published products.
export async function getPublishedProducts(
  brand?: string,
  category?: string,
  search?: string,
  inStockOnly = false,
): Promise<Product[]> {
  const sb = createAdminClient();
  let q = sb
    .from("products")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (brand) q = q.eq("brand", brand);
  if (category) q = q.eq("category", category);
  if (search) {
    // PostgREST or() treats , ( ) as syntax — strip them from user input.
    const term = search.replace(/[,()]/g, " ").trim();
    if (term) q = q.or(`title.ilike.%${term}%,brand.ilike.%${term}%`);
  }
  if (inStockOnly) q = q.eq("sold_out", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Product[];
}

// Yupoo seller categories matching a searched brand (canonical name or seller
// alias like "LEM" / "Pra"). Lets search fall through to "browse this brand at
// the seller" links even when we carry no matching product.
export interface SellerBrandLink {
  seller: string;
  brand: string;
  alias: string | null;
  url: string;
}
export async function getSellerBrandLinks(search: string): Promise<SellerBrandLink[]> {
  const term = search.replace(/[,()]/g, " ").trim();
  if (!term) return [];
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("seller_brand_links")
    .select("seller, brand, alias, url")
    .eq("active", true)
    .or(`brand.ilike.%${term}%,alias.ilike.%${term}%`)
    .order("brand");
  if (error) throw error;
  return (data ?? []) as SellerBrandLink[];
}

// Category slugs present among published products, in canonical display order.
export async function getCategories(): Promise<string[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("products")
    .select("category")
    .eq("published", true);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) if (r.category) set.add(r.category as string);
  return [...set].sort(
    (a, b) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99),
  );
}

export async function getProductById(id: string): Promise<Product | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Product) ?? null;
}

export async function getBrands(): Promise<string[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("products")
    .select("brand")
    .eq("published", true);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) if (r.brand) set.add(r.brand as string);
  return [...set].sort();
}

// ---- Haul / friends ----

// Deliberately excludes access_token (the login credential) — resolve identity
// from the friend_token cookie via getCurrentFriend() instead.
export async function getFriendByHandle(handle: string): Promise<Friend | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("friends")
    .select("id, name, handle, email, shipping_address, currency, is_admin, active, measurements")
    .eq("handle", handle)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Friend) ?? null;
}

export async function getProductByCode(code: string): Promise<Product | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("code", code)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return (data as Product) ?? null;
}

export async function getHaul(friendId: string): Promise<HaulItem[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("items")
    .select("*")
    .eq("owner_id", friendId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HaulItem[];
}

export async function getFriendsWithHaulCounts(): Promise<
  Array<Friend & { haul_count: number }>
> {
  const sb = createAdminClient();
  const { data: friends, error } = await sb
    .from("friends")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const out: Array<Friend & { haul_count: number }> = [];
  for (const f of (friends ?? []) as Friend[]) {
    const { count } = await sb
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", f.id);
    out.push({ ...f, haul_count: count ?? 0 });
  }
  return out;
}

// Fallback search: which sellers carry a brand friends searched for.
export async function getSellersForBrand(brand: string): Promise<Seller[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("sellers")
    .select("*")
    .contains("brands", [brand]);
  if (error) throw error;
  return (data ?? []) as Seller[];
}
