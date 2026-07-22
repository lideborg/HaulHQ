"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";
import type { Measurements, ShippingAddress } from "@/lib/types";

// Saves whatever the friend filled in and stamps onboarded_at on first save.
// Passing nulls (welcome-page "Skip for now") still stamps — the welcome page
// must never auto-appear twice. Identity from the cookie, never the URL.
export async function saveProfile(input: {
  address: ShippingAddress | null;
  measurements: Measurements | null;
}): Promise<{ ok: boolean; error?: string }> {
  const friend = await getCurrentFriend();
  if (!friend) return { ok: false, error: "Open your personal invite link first." };

  const patch: Record<string, unknown> = {};
  if (input.address) patch.shipping_address = input.address;
  if (input.measurements) patch.measurements = input.measurements;
  if (!friend.onboarded_at) patch.onboarded_at = new Date().toISOString();

  if (Object.keys(patch).length > 0) {
    const sb = createAdminClient();
    const { error } = await sb.from("friends").update(patch).eq("id", friend.id);
    if (error) return { ok: false, error: error.message };
  }
  if (friend.handle) {
    revalidatePath(`/${friend.handle}/profile`);
    revalidatePath(`/${friend.handle}/welcome`);
  }
  return { ok: true };
}
