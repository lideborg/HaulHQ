"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken, normalizeEmail, isEmail, resetTokenExpiry } from "@/lib/auth";
import { sendResetEmail, siteUrl } from "@/lib/email";
import { clientIp, isThrottled, recordFailure, failureDelay } from "@/lib/rateLimit";

// Self-serve reset. The response is identical whether or not the email exists
// (no account enumeration); the throttle stops bulk probing all the same.
export async function requestReset(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  const throttleKey = `forgot:${await clientIp()}`;
  if (isThrottled(throttleKey)) {
    await failureDelay();
    redirect("/forgot?sent=1");
  }
  recordFailure(throttleKey);

  if (isEmail(email)) {
    const sb = createAdminClient();
    const { data: friend } = await sb
      .from("friends")
      .select("id")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();
    if (friend) {
      const reset_token = randomToken();
      await sb
        .from("friends")
        .update({
          reset_token,
          reset_token_expires: resetTokenExpiry().toISOString(),
        })
        .eq("id", friend.id);
      await sendResetEmail(email, `${siteUrl()}/reset/${reset_token}`);
    }
  }
  redirect("/forgot?sent=1");
}
