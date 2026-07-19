"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const priceRaw = String(formData.get("price_usd") ?? "").trim();
  const price_usd = priceRaw === "" ? null : Number(priceRaw);
  // Guard against persisting NaN, which renders as "US$ NaN" on product cards.
  if (price_usd !== null && !Number.isFinite(price_usd)) {
    redirect("/admin/products?error=price");
  }
  const sb = createAdminClient();
  const { error } = await sb
    .from("products")
    .update({ title, price_usd })
    .eq("id", id);
  if (error) {
    console.error("updateProduct failed:", error);
    redirect("/admin/products?error=save");
  }
  revalidatePath("/admin/products");
}

export async function togglePublished(formData: FormData) {
  const id = String(formData.get("id"));
  const published = String(formData.get("published")) === "true";
  const sb = createAdminClient();
  const { error } = await sb
    .from("products")
    .update({ published: !published })
    .eq("id", id);
  if (error) {
    console.error("togglePublished failed:", error);
    redirect("/admin/products?error=save");
  }
  revalidatePath("/admin/products");
}

export async function toggleSoldOut(formData: FormData) {
  const id = String(formData.get("id"));
  const sold_out = String(formData.get("sold_out")) === "true";
  const sb = createAdminClient();
  const { error } = await sb
    .from("products")
    .update({ sold_out: !sold_out })
    .eq("id", id);
  if (error) {
    console.error("toggleSoldOut failed:", error);
    redirect("/admin/products?error=save");
  }
  revalidatePath("/admin/products");
}
