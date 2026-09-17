"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, tokenExpired } from "@/lib/auth";

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pw.length < 6) redirect(`/reset/${token}?error=short`);
  if (pw !== confirm) redirect(`/reset/${token}?error=match`);

  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("id, access_token, reset_token_expires, onboarded_at, active")
    .eq("reset_token", token)
    .maybeSingle();
  if (!friend || !friend.active || tokenExpired(friend.reset_token_expires))
    redirect(`/reset/${token}?error=invalid`);

  await sb
    .from("friends")
    .update({
      password_hash: await hashPassword(pw),
      reset_token: null,
      reset_token_expires: null,
    })
    .eq("id", friend.id);

  (await cookies()).set("friend_token", friend.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(friend.onboarded_at ? "/shop" : "/welcome");
}
