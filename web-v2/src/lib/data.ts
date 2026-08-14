import { createAdminClient } from "./supabase/admin";
import type { Product, Seller, Friend, Haul, HaulItem } from "./types";
import { CATEGORY_ORDER } from "./categories";
import { groupFactories, type FactoryCard } from "./factories";
import {
  UNLOCKED_STATUSES,
  isUnlocked,
  groupItemsByHaul,
  type HaulGroup,
} from "./hauls";

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
  opts: { sort?: string; color?: string; min?: number; max?: number } = {},
): Promise<Product[]> {
  const sb = createAdminClient();
  let q = sb.from("products").select("*").eq("published", true);
  if (brand) q = q.eq("brand", brand);
  if (category) q = q.eq("category", category);
  if (opts.color) q = q.eq("color", opts.color);
  const term = searchTerm(search);
  if (term)
    q = q.or(`title.ilike.%${term}%,brand.ilike.%${term}%,display_title.ilike.%${term}%`);
  if (inStockOnly) q = q.eq("sold_out", false);
  if (typeof opts.min === "number") q = q.gte("price_usd", opts.min);
  if (typeof opts.max === "number") q = q.lte("price_usd", opts.max);

  // Non-popular sorts map straight to an ORDER BY; popular needs the add-counts.
  if (opts.sort === "price-asc")
    q = q.order("price_usd", { ascending: true, nullsFirst: false });
  else if (opts.sort === "price-desc")
    q = q.order("price_usd", { ascending: false, nullsFirst: false });
  else if (opts.sort === "brand")
    q = q.order("brand", { ascending: true }).order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: false }); // "new" and default

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as Product[];

  if (opts.sort === "popular") {
    const { data: pop } = await sb
      .from("product_popularity")
      .select("product_id, adds");
    const rank = new Map(
      (pop ?? []).map((r) => [r.product_id as string, r.adds as number]),
    );
    rows = [...rows].sort(
      (a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0),
    );
  }
  return rows;
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
  // 22P02 = malformed uuid in the URL — that's a 404, not a 500.
  if (error?.code === "22P02") return null;
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

type AdminClient = ReturnType<typeof createAdminClient>;

// The friend's one open haul, created lazily on first use. The partial unique
// index (one open haul per owner) makes concurrent creates safe: losers of the
// race fail the insert and re-select the winner.
export async function getOrCreateOpenHaul(
  sb: AdminClient,
  ownerId: string,
): Promise<Haul> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: open } = await sb
      .from("hauls")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("status", "open")
      .maybeSingle();
    if (open) return open as Haul;
    const { data: maxRow } = await sb
      .from("hauls")
      .select("number")
      .eq("owner_id", ownerId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: created, error } = await sb
      .from("hauls")
      .insert({
        owner_id: ownerId,
        number: ((maxRow?.number as number) ?? 0) + 1,
        status: "open",
      })
      .select("*")
      .maybeSingle();
    if (created) return created as Haul;
    if (error && !/duplicate|unique/i.test(error.message)) throw error;
  }
  throw new Error("could not create an open haul");
}

// Adopt items written without a haul_id (old code mid-deploy): unlocked ones
// join the open haul, locked ones join the newest approved haul. Idempotent
// and almost always a no-op, so it's safe to run on page loads.
async function ensureHaulAssignments(sb: AdminClient, ownerId: string) {
  const { data: orphans } = await sb
    .from("items")
    .select("id, status")
    .eq("owner_id", ownerId)
    .is("haul_id", null);
  if (!orphans || orphans.length === 0) return;

  const unlockedIds = orphans.filter((o) => isUnlocked(o.status)).map((o) => o.id);
  const lockedIds = orphans.filter((o) => !isUnlocked(o.status)).map((o) => o.id);

  if (unlockedIds.length > 0) {
    const open = await getOrCreateOpenHaul(sb, ownerId);
    await sb.from("items").update({ haul_id: open.id }).in("id", unlockedIds);
  }
  if (lockedIds.length > 0) {
    const { data: approved } = await sb
      .from("hauls")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("status", "approved")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    let target = approved as Haul | null;
    if (!target) {
      const { data: maxRow } = await sb
        .from("hauls")
        .select("number")
        .eq("owner_id", ownerId)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: createdHaul } = await sb
        .from("hauls")
        .insert({
          owner_id: ownerId,
          number: ((maxRow?.number as number) ?? 0) + 1,
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();
      target = createdHaul as Haul | null;
    }
    if (target)
      await sb.from("items").update({ haul_id: target.id }).in("id", lockedIds);
  }
}

// Everything the haul surfaces need: the open haul being built plus the
// approved archive, items embedded per haul.
export async function getHaulsWithItems(
  friendId: string,
): Promise<{ open: HaulGroup | null; past: HaulGroup[] }> {
  const sb = createAdminClient();
  await ensureHaulAssignments(sb, friendId);
  const [{ data: hauls, error }, { data: items, error: itemsError }] =
    await Promise.all([
      sb.from("hauls").select("*").eq("owner_id", friendId),
      sb
        .from("items")
        .select("*, products (weight_g, display_title, brand_slug, code)")
        .eq("owner_id", friendId),
    ]);
  if (error) throw error;
  if (itemsError) throw itemsError;
  return groupItemsByHaul((hauls ?? []) as Haul[], (items ?? []) as HaulItem[]);
}

// Units (sum of quantities) in the CURRENT haul — unlocked statuses only, so
// the nav badge resets when a haul is approved and counts the new batch.
// Null status counts as unlocked, matching isUnlocked.
export async function getHaulCount(friendId: string): Promise<number> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("items")
    .select("quantity")
    .eq("owner_id", friendId)
    .or(`status.is.null,status.in.(${UNLOCKED_STATUSES.join(",")})`);
  if (error) throw error;
  return (data ?? []).reduce((s, r) => s + ((r.quantity as number) ?? 1), 0);
}

export async function getFriendsWithHaulCounts(): Promise<
  Array<Friend & { haul_count: number }>
> {
  const sb = createAdminClient();
  // Two queries total (was one count query per friend). haul_count is UNITS
  // (sum of quantities), matching getHaulCount and the haul page heading.
  const [{ data: friends, error }, { data: items, error: itemsError }] =
    await Promise.all([
      sb.from("friends").select("*").order("created_at", { ascending: true }),
      sb.from("items").select("owner_id, quantity"),
    ]);
  if (error) throw error;
  if (itemsError) throw itemsError;
  const units = new Map<string, number>();
  for (const i of items ?? []) {
    const id = i.owner_id as string;
    units.set(id, (units.get(id) ?? 0) + ((i.quantity as number) ?? 1));
  }
  return ((friends ?? []) as Friend[]).map((f) => ({
    ...f,
    haul_count: units.get(f.id) ?? 0,
  }));
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
