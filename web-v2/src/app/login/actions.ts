"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword, normalizeEmail } from "@/lib/auth";
import { clientIp, isThrottled, recordFailure, failureDelay } from "@/lib/rateLimit";

export async function loginFriend(formData: FormData) {
  const id = normalizeEmail(String(formData.get("email") ?? ""));
  const pw = String(formData.get("password") ?? "");

  const throttleKey = `login:${id}:${await clientIp()}`;
  if (isThrottled(throttleKey)) {
    await failureDelay();
    redirect("/login?error=1");
  }

  const sb = createAdminClient();
  // Email is the credential; the legacy anonymous handle (u#####) still works
  // silently so friends who predate email login aren't locked out. Emails are
  // stored normalized (trimmed + lowercased), so exact match is correct.
  let { data: friend } = await sb
    .from("friends")
    .select("access_token, email, password_hash, onboarded_at, active")
    .eq("email", id)
    .maybeSingle();
  if (!friend) {
    ({ data: friend } = await sb
      .from("friends")
      .select("access_token, email, password_hash, onboarded_at, active")
      .eq("handle", id)
      .maybeSingle());
  }

  // Generic failure for missing user / no password / wrong password (no enumeration).
  if (
    !friend ||
    !friend.active ||
    !friend.password_hash ||
    !(await verifyPassword(pw, friend.password_hash))
  ) {
    recordFailure(throttleKey);
    await failureDelay();
    redirect("/login?error=1");
  }

  (await cookies()).set("friend_token", friend.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // Legacy friends without an email get gated to add one ((friend) layout
  // enforces the same rule; this just lands them there directly).
  if (!friend.email) redirect("/account/email");
  redirect(friend.onboarded_at ? "/shop" : "/welcome");
}

export async function logout() {
  // Expire with the SAME attributes it was set with (esp. path: "/"). A bare
  // cookies().delete("friend_token") defaults Path to the current request path,
  // which won't match the path-"/" login cookie, so the browser keeps it.
  (await cookies()).set("friend_token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  redirect("/login");
}
