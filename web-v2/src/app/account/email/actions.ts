"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";
import { normalizeEmail, isEmail } from "@/lib/auth";

// Legacy friends (handle-era accounts) add the email that becomes their login.
export async function saveEmail(formData: FormData) {
  const friend = await getCurrentFriend();
  if (!friend) redirect("/login");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isEmail(email)) redirect("/account/email?error=format");

  const sb = createAdminClient();
  const { error } = await sb.from("friends").update({ email }).eq("id", friend.id);
  // The partial unique index on lower(email) rejects an address already used
  // by another friend.
  if (error) redirect("/account/email?error=taken");
  redirect(friend.onboarded_at ? "/shop" : "/welcome");
}
