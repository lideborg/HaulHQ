"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFriendByHandle } from "@/lib/data";

// A friend adds a product to their haul (idempotent per owner+product).
export async function addToHaul(
  handle: string,
  productId: string,
  size: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const friend = await getFriendByHandle(handle);
  if (!friend) return { ok: false, error: "Unknown friend." };

  const sb = createAdminClient();
  const { data: product } = await sb
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Product not found." };

  const { error } = await sb.from("items").upsert(
    {
      owner_id: friend.id,
      product_id: product.id,
      title: product.title,
      brand: product.brand,
      image_urls: product.image_urls,
      chosen_size: size,
      quoted_price_usd: product.price_usd,
      status: "saved",
    },
    { onConflict: "owner_id,product_id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${handle}/haul`);
  return { ok: true };
}

export async function removeFromHaul(
  handle: string,
  itemId: string,
): Promise<void> {
  const friend = await getFriendByHandle(handle);
  if (!friend) return;
  const sb = createAdminClient();
  await sb.from("items").delete().eq("id", itemId).eq("owner_id", friend.id);
  revalidatePath(`/${handle}/haul`);
}
