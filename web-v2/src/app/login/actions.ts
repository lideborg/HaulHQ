"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth";
import { clientIp, isThrottled, recordFailure, failureDelay } from "@/lib/rateLimit";

export async function loginFriend(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim().toLowerCase();
  const pw = String(formData.get("password") ?? "");

  const throttleKey = `login:${id}:${await clientIp()}`;
  if (isThrottled(throttleKey)) {
    await failureDelay();
    redirect("/login?error=1");
  }

  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("access_token, handle, password_hash, onboarded_at, active")
    .eq("handle", id)
    .maybeSingle();

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
  redirect(
    friend.onboarded_at ? `/${friend.handle}/shop` : `/${friend.handle}/welcome`,
  );
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
