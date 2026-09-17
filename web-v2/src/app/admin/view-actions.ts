"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";

// Admin browses the friend surface as a specific friend (drives getViewer()).
// Optional `next` (an internal path) lands the admin on a specific page, e.g.
// a product straight from the haul admin.
export async function viewAsFriend(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin");
  (await cookies()).set("view_as", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/shop");
}

export async function exitViewAs() {
  await requireAdmin();
  (await cookies()).set("view_as", "", { path: "/", maxAge: 0 });
  redirect("/admin");
}
