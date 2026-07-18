"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const priceRaw = String(formData.get("price_usd") ?? "").trim();
  const price_usd = priceRaw === "" ? null : Number(priceRaw);
  const sb = createAdminClient();
  await sb.from("products").update({ title, price_usd }).eq("id", id);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function togglePublished(formData: FormData) {
  const id = String(formData.get("id"));
  const published = String(formData.get("published")) === "true";
  const sb = createAdminClient();
  await sb.from("products").update({ published: !published }).eq("id", id);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function toggleSoldOut(formData: FormData) {
  const id = String(formData.get("id"));
  const sold_out = String(formData.get("sold_out")) === "true";
  const sb = createAdminClient();
  await sb.from("products").update({ sold_out: !sold_out }).eq("id", id);
  revalidatePath("/admin/products");
  revalidatePath("/");
}
