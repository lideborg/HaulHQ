"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";

export async function setPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pw.length < 6) redirect(`/setup/${token}?error=short`);
  if (pw !== confirm) redirect(`/setup/${token}?error=match`);

  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("access_token, handle, onboarded_at")
    .eq("setup_token", token)
    .maybeSingle();
  if (!friend) redirect(`/setup/${token}?error=invalid`);

  await sb
    .from("friends")
    .update({ password_hash: await hashPassword(pw), setup_token: null })
    .eq("setup_token", token);

  (await cookies()).set("friend_token", friend.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(
    friend.onboarded_at ? `/${friend.handle}/shop` : `/${friend.handle}/welcome`,
  );
}
