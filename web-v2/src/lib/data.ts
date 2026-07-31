import { createAdminClient } from "./supabase/admin";
import type { Product, Seller, Friend, HaulItem } from "./types";
import { CATEGORY_ORDER } from "./categories";
import { groupFactories, type FactoryCard } from "./factories";

// Make user input safe inside a PostgREST or(...ilike...) filter: , ( ) are
// or()-syntax, and % _ \ are LIKE wildcards that would match everything.
function searchTerm(search?: string): string {
  if (!search) return "";
  return search
    .replace(/[,()]/g, " ")
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .trim();
}

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
  const term = searchTerm(search);
  if (term)
    q = q.or(`title.ilike.%${term}%,brand.ilike.%${term}%,display_title.ilike.%${term}%`);
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
  const term = searchTerm(search);
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

// Sidebar facets in one query: every published product's brand + category,
// tallied. Counts are catalog-wide (not narrowed by the active filter).
export interface ShopFacets {
  total: number;
  brands: Array<{ name: string; count: number }>;
  categories: Array<{ slug: string; count: number }>;
}
export async function getShopFacets(inStockOnly = false): Promise<ShopFacets> {
  const sb = createAdminClient();
  let fq = sb.from("products").select("brand, category").eq("published", true);
  if (inStockOnly) fq = fq.eq("sold_out", false);
  const { data, error } = await fq;
  if (error) throw error;
  const brandCount = new Map<string, number>();
  const catCount = new Map<string, number>();
  for (const r of data ?? []) {
    if (r.brand) brandCount.set(r.brand, (brandCount.get(r.brand) ?? 0) + 1);
    if (r.category) catCount.set(r.category, (catCount.get(r.category) ?? 0) + 1);
  }
  return {
    total: (data ?? []).length,
    brands: [...brandCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...catCount.entries()]
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => (CATEGORY_ORDER[a.slug] ?? 99) - (CATEGORY_ORDER[b.slug] ?? 99)),
  };
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

// ---- Haul / friends ----

// Deliberately excludes access_token (the login credential). Resolve identity
// from the friend_token cookie via getCurrentFriend() instead. The return type
// reflects that so callers can't compile against the missing field.
export async function getFriendByHandle(
  handle: string,
): Promise<Omit<Friend, "access_token"> | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("friends")
    .select("id, name, handle, shipping_address, currency, is_admin, active, measurements")
    .eq("handle", handle)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Omit<Friend, "access_token">) ?? null;
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
  // Embed the live product for weight + card name (null for link-only requests).
  const { data, error } = await sb
    .from("items")
    .select("*, products (weight_g, display_title, brand_slug, code)")
    .eq("owner_id", friendId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HaulItem[];
}

export async function getHaulCount(friendId: string): Promise<number> {
  const sb = createAdminClient();
  const { count, error } = await sb
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", friendId);
  if (error) throw error;
  return count ?? 0;
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

// Factories page: all curated sellers, plus (when searching) direct brand
// category links grouped onto them by Yupoo subdomain. `searchTerm` here is
// only a "is there a real query?" gate — `getSellerBrandLinks` escapes the raw
// query itself, and the pure grouper does plain substring matching, so both
// receive the raw (trimmed) `q` rather than the wildcard-escaped form.
export async function getFactories(q?: string | null): Promise<FactoryCard[]> {
  const term = searchTerm(q ?? "");
  const sb = createAdminClient();
  const [{ data: sellers, error }, links] = await Promise.all([
    sb.from("sellers").select("*").order("name"),
    term ? getSellerBrandLinks(q ?? "") : Promise.resolve([]),
  ]);
  if (error) throw error;
  return groupFactories((sellers ?? []) as Seller[], links, (q ?? "").trim());
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
