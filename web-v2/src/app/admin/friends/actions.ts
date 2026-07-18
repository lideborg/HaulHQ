"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHandle } from "@/lib/handles";

// Create a friend + their handle; returns them to /admin with a banner.
export async function createFriend(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  if (!name) redirect("/admin?error=name");
  if (!isValidHandle(handle)) redirect("/admin?error=handle");

  const sb = createAdminClient();
  const { error } = await sb.from("friends").insert({
    name,
    handle,
    active: true,
    access_token: randomUUID(),
  });
  if (error) {
    if (error.code === "23505") redirect("/admin?error=taken");
    redirect("/admin?error=save");
  }
  revalidatePath("/admin");
  redirect(`/admin?created=${handle}`);
}

// Admin-only: flip the "I'll source this" flag on a haul item.
export async function toggleSource(formData: FormData) {
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
  const id = String(formData.get("id"));
  const handle = String(formData.get("handle"));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id) return;
  const sb = createAdminClient();
  await sb.from("items").update({ admin_note: note }).eq("id", id);
  revalidatePath(`/admin/friends/${handle}`);
}
