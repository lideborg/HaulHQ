"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";

// A friend adds a product to their haul (idempotent per owner+product).
// Ownership is derived from the authenticated `friend_token` cookie, NOT from the
// URL handle — otherwise anyone could write to another friend's haul (IDOR).
export async function addToHaul(
  handle: string,
  productId: string,
  size: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) {
    return { ok: false, error: "Open your personal invite link first." };
  }

  const sb = createAdminClient();
  const { data: product } = await sb
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("published", true)
    .maybeSingle();
  if (!product) return { ok: false, error: "Product not found." };
  if (product.sold_out) return { ok: false, error: "This one's sold out." };

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
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) return;
  const sb = createAdminClient();
  await sb.from("items").delete().eq("id", itemId).eq("owner_id", friend.id);
  revalidatePath(`/${handle}/haul`);
}
