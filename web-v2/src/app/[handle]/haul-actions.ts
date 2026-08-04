"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";
import { getOrCreateOpenHaul } from "@/lib/data";
import { UNLOCKED_STATUSES, REMOVABLE_STATUSES } from "@/lib/hauls";

// A friend adds a product to their CURRENT haul (idempotent per open haul +
// product; a copy in a past approved haul doesn't block re-ordering it).
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

  const openHaul = await getOrCreateOpenHaul(sb, friend.id);

  // Re-adding an item must not reset admin-managed state (status transitions,
  // negotiated quoted_price_usd) — only refresh the friend's size choice.
  const { data: existing } = await sb
    .from("items")
    .select("id")
    .eq("owner_id", friend.id)
    .eq("product_id", product.id)
    .eq("haul_id", openHaul.id)
    .maybeSingle();
  const { error } = existing
    ? await sb.from("items").update({ chosen_size: size }).eq("id", existing.id)
    : await sb.from("items").insert({
        owner_id: friend.id,
        haul_id: openHaul.id,
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
  // Confirmed/ordered items are locked - the friend approved this haul. An
  // item admin marked "unavailable" can still be tidied away by the friend.
  await sb
    .from("items")
    .delete()
    .eq("id", itemId)
    .eq("owner_id", friend.id)
    .in("status", REMOVABLE_STATUSES);
  revalidatePath(`/${handle}/haul`);
}

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

// Single tap: closes the OPEN haul — its editable items lock in, the haul is
// stamped approved, admin gets pinged. The next add starts the next number.
export async function approveHaul(handle: string): Promise<void> {
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) return;
  const sb = createAdminClient();
  const { data: open } = await sb
    .from("hauls")
    .select("*")
    .eq("owner_id", friend.id)
    .eq("status", "open")
    .maybeSingle();
  if (!open) return;
  const { data: locked } = await sb
    .from("items")
    .update({ status: "confirmed" })
    .eq("owner_id", friend.id)
    .eq("haul_id", open.id)
    .in("status", UNLOCKED_STATUSES)
    .select("id");
  if (locked && locked.length > 0) {
    await sb
      .from("hauls")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", open.id);
    await sb.from("notifications").insert({
      kind: "haul_confirmed",
      friend_id: friend.id,
      payload: { friend: friend.name, items: locked.length, haul: open.number },
    });
    await sb.from("status_events").insert(
      locked.map((i) => ({
        item_id: i.id,
        status: "confirmed",
        note: `Haul ${open.number} approved by friend`,
      })),
    );
    revalidatePath(`/${handle}/haul`);
    redirect(`/${handle}/haul?approved=${open.number}`);
  }
  revalidatePath(`/${handle}/haul`);
}
