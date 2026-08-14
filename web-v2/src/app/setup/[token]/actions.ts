"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";
import { usernameError } from "@/lib/username";

export async function setPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (pw.length < 6) redirect(`/setup/${token}?error=short`);
  if (pw !== confirm) redirect(`/setup/${token}?error=match`);
  // Email is required at onboarding so admin can always reach a friend with
  // order updates. Basic shape check; the approve-haul field can update it later.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(`/setup/${token}?error=email`);

  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("id, access_token, handle, onboarded_at, active")
    .eq("setup_token", token)
    .maybeSingle();
  if (!friend || !friend.active) redirect(`/setup/${token}?error=invalid`);

  // The friend may keep their auto-generated id or pick their own username.
  // Empty or unchanged keeps the current handle.
  let handle = friend.handle;
  if (username && username !== friend.handle) {
    const err = usernameError(username);
    if (err) redirect(`/setup/${token}?error=${err}`);
    const { data: taken } = await sb
      .from("friends")
      .select("id")
      .eq("handle", username)
      .maybeSingle();
    if (taken) redirect(`/setup/${token}?error=taken`);
    handle = username;
  }

  await sb
    .from("friends")
    .update({ password_hash: await hashPassword(pw), setup_token: null, handle, email })
    .eq("id", friend.id);

  (await cookies()).set("friend_token", friend.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(friend.onboarded_at ? `/${handle}/shop` : `/${handle}/welcome`);
}
