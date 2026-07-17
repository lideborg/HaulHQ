import { createAdminClient } from "./supabase/admin";
import type { Product, Seller } from "./types";

// Server-only reads (service role). Friends only ever see published products.
export async function getPublishedProducts(brand?: string): Promise<Product[]> {
  const sb = createAdminClient();
  let q = sb
    .from("products")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (brand) q = q.eq("brand", brand);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Product[];
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
