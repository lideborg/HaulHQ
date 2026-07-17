"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";

export async function addToCart(productId: string, size: string | null) {
  const friend = await getCurrentFriend();
  if (!friend) return { ok: false, error: "No friend session." };

  const sb = createAdminClient();
  const { data: product } = await sb
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Product not found." };

  const { data: item, error } = await sb
    .from("items")
    .insert({
      owner_id: friend.id,
      product_id: product.id,
      title: product.title,
      brand: product.brand,
      image_urls: product.image_urls,
      chosen_size: size,
      quoted_price_usd: product.price_usd,
      status: "requested",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await sb
    .from("status_events")
    .insert({ item_id: item.id, status: "requested", note: "Added to cart" });

  revalidatePath("/orders");
  return { ok: true };
}
