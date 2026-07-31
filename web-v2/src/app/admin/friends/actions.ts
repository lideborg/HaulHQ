"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/adminAuth";
import { randomUserId, randomToken } from "@/lib/auth";

async function uniqueUserId(
  sb: ReturnType<typeof createAdminClient>,
): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const id = randomUserId();
    const { data } = await sb
      .from("friends")
      .select("handle")
      .eq("handle", id)
      .maybeSingle();
    if (!data) return id;
  }
  throw new Error("could not generate a unique id");
}

// Create a friend: `name` is a PRIVATE admin-only label (never shown publicly).
// Generates the anonymous u##### id + a one-time setup token, then shows the
// admin a /setup/<token> link to send.
export async function createFriend(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin?error=name");

  const sb = createAdminClient();
  const handle = await uniqueUserId(sb);
  const setup_token = randomToken();
  const { error } = await sb.from("friends").insert({
    name,
    handle,
    active: true,
    access_token: randomUUID(),
    setup_token,
  });
  if (error) redirect("/admin?error=save");
  revalidatePath("/admin");
  redirect(`/admin?setup=${setup_token}&id=${handle}&action=create`);
}

// Issue a fresh setup link so the friend can set a new password. The old
// password keeps working until they complete the new setup (we don't clear it).
export async function resetFriendPassword(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = createAdminClient();
  const setup_token = randomToken();
  await sb.from("friends").update({ setup_token }).eq("handle", id);
  revalidatePath("/admin");
  redirect(`/admin?setup=${setup_token}&id=${id}&action=reset`);
}

export async function deleteFriend(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("id")
    .eq("handle", id)
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

// Admin-only: flip the "I'll source this" flag on a haul item.
export async function toggleSource(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const handle = String(formData.get("handle"));
  if (!id) return;
  const sb = createAdminClient();
  const { data } = await sb.from("items").select("to_source").eq("id", id).maybeSingle();
  await sb.from("items").update({ to_source: !data?.to_source }).eq("id", id);
  revalidatePath(`/admin/friends/${handle}`);
}

// Admin-only: save a private note on a haul item.
export async function setAdminNote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const handle = String(formData.get("handle"));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id) return;
  const sb = createAdminClient();
  await sb.from("items").update({ admin_note: note }).eq("id", id);
  revalidatePath(`/admin/friends/${handle}`);
}
