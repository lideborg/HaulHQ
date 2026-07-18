"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Temporary data-cleanup helpers — delete this folder when the pass is done.
export async function setBrand(formData: FormData) {
  const id = String(formData.get("id"));
  const brand = String(formData.get("brand") ?? "").trim();
  if (!id || !brand) return;
  const sb = createAdminClient();
  await sb.from("products").update({ brand }).eq("id", id);
  revalidatePath("/admin/cleanup");
  revalidatePath("/");
}

export async function setTitle(formData: FormData) {
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) return;
  const sb = createAdminClient();
  await sb.from("products").update({ title }).eq("id", id);
  revalidatePath("/admin/cleanup");
  revalidatePath("/");
}
