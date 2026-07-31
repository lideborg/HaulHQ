"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sha256Hex } from "@/lib/adminAuth";
import { clientIp, isThrottled, recordFailure, failureDelay } from "@/lib/rateLimit";

// Compare hashes (equal length) with timingSafeEqual - a plain === on the
// raw password is a timing side-channel.
async function passwordMatches(pw: string, expected: string): Promise<boolean> {
  const a = Buffer.from(await sha256Hex(pw), "hex");
  const b = Buffer.from(await sha256Hex(expected), "hex");
  return timingSafeEqual(a, b);
}

export async function login(formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  const throttleKey = `admin:${await clientIp()}`;
  if (isThrottled(throttleKey)) {
    await failureDelay();
    redirect("/admin/login?error=1");
  }

  if (pw && expected && (await passwordMatches(pw, expected))) {
    (await cookies()).set("admin_session", await sha256Hex(pw), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/admin");
  }

  recordFailure(throttleKey);
  await failureDelay();
  redirect("/admin/login?error=1");
}
