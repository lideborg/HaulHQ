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

  // Re-adding an item must not reset admin-managed state (status transitions,
  // negotiated quoted_price_usd) — only refresh the friend's size choice.
  const { data: existing } = await sb
    .from("items")
    .select("id")
    .eq("owner_id", friend.id)
    .eq("product_id", product.id)
    .maybeSingle();
  const { error } = existing
    ? await sb.from("items").update({ chosen_size: size }).eq("id", existing.id)
    : await sb.from("items").insert({
        owner_id: friend.id,
        product_id: product.id,
        title: product.title,
        brand: product.brand,
        image_urls: product.image_urls,
        chosen_size: size,
        quoted_price_usd: product.price_usd,
        status: "saved",
      });
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
  // Confirmed/ordered items are locked - the friend approved this haul.
  await sb
    .from("items")
    .delete()
    .eq("id", itemId)
    .eq("owner_id", friend.id)
    .in("status", UNLOCKED_STATUSES);
  revalidatePath(`/${handle}/haul`);
}

// Statuses a friend may still edit; anything else is locked (confirmed by
// them, or already in the admin's order flow).
const UNLOCKED_STATUSES = ["saved", "requested", "sourcing", "quoted"];

export async function setQuantity(
  handle: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) return;
  const qty = Math.max(1, Math.min(9, Math.round(quantity)));
  const sb = createAdminClient();
  await sb
    .from("items")
    .update({ quantity: qty })
    .eq("id", itemId)
    .eq("owner_id", friend.id)
    .in("status", UNLOCKED_STATUSES);
  revalidatePath(`/${handle}/haul`);
}

// Single tap: locks every editable item in the haul and pings the admin.
// The friend is saying "this is exactly what I want".
export async function approveHaul(handle: string): Promise<void> {
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) return;
  const sb = createAdminClient();
  const { data: locked } = await sb
    .from("items")
    .update({ status: "confirmed" })
    .eq("owner_id", friend.id)
    .in("status", UNLOCKED_STATUSES)
    .select("id");
  if (locked && locked.length > 0) {
    await sb.from("notifications").insert({
      kind: "haul_confirmed",
      friend_id: friend.id,
      payload: { friend: friend.name, items: locked.length },
    });
    await sb.from("status_events").insert(
      locked.map((i) => ({
        item_id: i.id,
        status: "confirmed",
        note: "Haul approved by friend",
      })),
    );
  }
  revalidatePath(`/${handle}/haul`);
}
