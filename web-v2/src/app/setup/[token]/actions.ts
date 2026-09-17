"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, normalizeEmail, isEmail } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

export async function setPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  // Email is the login credential, so it's required and must be unique.
  if (!isEmail(email)) redirect(`/setup/${token}?error=email`);
  if (pw.length < 6) redirect(`/setup/${token}?error=short`);
  if (pw !== confirm) redirect(`/setup/${token}?error=match`);

  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("id, access_token, onboarded_at, active")
    .eq("setup_token", token)
    .maybeSingle();
  if (!friend || !friend.active) redirect(`/setup/${token}?error=invalid`);

  const { error } = await sb
    .from("friends")
    .update({ password_hash: await hashPassword(pw), setup_token: null, email })
    .eq("id", friend.id);
  // The partial unique index on lower(email) rejects an address already used
  // by another friend.
  if (error) redirect(`/setup/${token}?error=taken`);

  // Fire-and-forget confirmation; a mail hiccup must not block account setup.
  await sendWelcomeEmail(email);

  (await cookies()).set("friend_token", friend.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(friend.onboarded_at ? "/shop" : "/welcome");
}
