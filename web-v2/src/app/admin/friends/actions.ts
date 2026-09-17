"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/adminAuth";
import { randomToken } from "@/lib/auth";

// Create a friend: `name` is a PRIVATE admin-only label (never shown publicly).
// Generates a one-time setup token, then shows the admin a /setup/<token> link
// to send. The friend picks their own email + password on that page.
export async function createFriend(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin?error=name");

  const sb = createAdminClient();
  const setup_token = randomToken();
  const { error } = await sb.from("friends").insert({
    name,
    active: true,
    access_token: randomUUID(),
    setup_token,
  });
  if (error) redirect("/admin?error=save");
  revalidatePath("/admin");
  redirect(`/admin?setup=${setup_token}&who=${encodeURIComponent(name)}&action=create`);
}

// Issue a fresh setup link so the friend can set a new password. The old
// password keeps working until they complete the new setup (we don't clear it).
export async function resetFriendPassword(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = createAdminClient();
  const setup_token = randomToken();
  const { data: friend } = await sb
    .from("friends")
    .update({ setup_token })
    .eq("id", id)
    .select("name")
    .maybeSingle();
  if (!friend) redirect("/admin");
  revalidatePath("/admin");
  redirect(`/admin?setup=${setup_token}&who=${encodeURIComponent(friend.name)}&action=reset`);
}

export async function deleteFriend(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("id")
    .eq("id", id)
    .eq("is_admin", false)
    .maybeSingle();
  if (!friend) redirect("/admin");
  // items cascade on friend delete, but notifications/orders/payments are
  // NO ACTION - a friend with any of those would 500 the delete. Notifications
  // are disposable; real order/payment history must block with a message.
  const [{ count: orders }, { count: payments }] = await Promise.all([
    sb.from("orders").select("*", { count: "exact", head: true }).eq("owner_id", friend.id),
    sb.from("payments").select("*", { count: "exact", head: true }).eq("owner_id", friend.id),
  ]);
  if ((orders ?? 0) > 0 || (payments ?? 0) > 0)
    redirect("/admin?error=has-orders");
  await sb.from("notifications").delete().eq("friend_id", friend.id);
  await sb.from("friends").delete().eq("id", friend.id);
  revalidatePath("/admin");
  redirect("/admin");
}

// Admin-only: reopen a specific approved haul so the friend can edit it again.
// Confirmed items go back to "saved"; items the admin already moved to
// ordered/shipped are untouched. A friend has at most one open haul, so any
// newer in-progress haul is folded into the reopened one and its (higher)
// number is freed — the sequence stays clean.
export async function unlockHaul(formData: FormData) {
  await requireAdmin();
  const friendId = String(formData.get("friend_id") ?? "");
  const haulId = String(formData.get("haul_id") ?? "");
  if (!friendId || !haulId) return;
  const sb = createAdminClient();
  const { data: haul } = await sb
    .from("hauls")
    .select("*")
    .eq("id", haulId)
    .eq("status", "approved")
    .maybeSingle();
  if (!haul) return;
  await sb
    .from("items")
    .update({ status: "saved" })
    .eq("haul_id", haul.id)
    .eq("status", "confirmed");
  const { data: open } = await sb
    .from("hauls")
    .select("id")
    .eq("owner_id", haul.owner_id)
    .eq("status", "open")
    .maybeSingle();
  if (open) {
    await sb.from("items").update({ haul_id: haul.id }).eq("haul_id", open.id);
    await sb.from("hauls").delete().eq("id", open.id);
  }
  // Surface a failed flip (e.g. the friend created a fresh open haul in the
  // window above; the one-open-haul index rejects a second) instead of
  // silently leaving saved items inside an approved haul.
  const { error: flipError } = await sb
    .from("hauls")
    .update({ status: "open", approved_at: null })
    .eq("id", haul.id);
  if (flipError) throw flipError;
  revalidatePath(`/admin/friends/${friendId}`);
  revalidatePath("/haul");
}

// Admin-only: flip the "I'll source this" flag on a haul item.
export async function toggleSource(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const friendId = String(formData.get("friend_id"));
  if (!id) return;
  const sb = createAdminClient();
  const { data } = await sb.from("items").select("to_source").eq("id", id).maybeSingle();
  await sb.from("items").update({ to_source: !data?.to_source }).eq("id", id);
  revalidatePath(`/admin/friends/${friendId}`);
}

// Admin-only: flip an item between "available" and "not available from
// seller". Marking it unavailable keeps the row in the friend's haul but drops
// it from every total and the order flow. Restoring returns it to the right
// editable/locked state for its haul (a still-open haul → saved; an already
// approved haul → confirmed).
export async function toggleUnavailable(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const friendId = String(formData.get("friend_id"));
  if (!id) return;
  const sb = createAdminClient();
  const { data: item } = await sb
    .from("items")
    .select("status, haul_id")
    .eq("id", id)
    .maybeSingle();
  if (!item) return;
  let next: string;
  if (item.status === "unavailable") {
    const { data: haul } = item.haul_id
      ? await sb
          .from("hauls")
          .select("status")
          .eq("id", item.haul_id)
          .maybeSingle()
      : { data: null };
    next = haul?.status === "approved" ? "confirmed" : "saved";
  } else {
    next = "unavailable";
  }
  await sb.from("items").update({ status: next }).eq("id", id);
  revalidatePath(`/admin/friends/${friendId}`);
  revalidatePath("/haul");
}

// Admin-only: save a private note on a haul item.
export async function setAdminNote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const friendId = String(formData.get("friend_id"));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id) return;
  const sb = createAdminClient();
  await sb.from("items").update({ admin_note: note }).eq("id", id);
  revalidatePath(`/admin/friends/${friendId}`);
}
