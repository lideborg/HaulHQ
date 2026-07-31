"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";
import { usernameError } from "@/lib/username";
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

// Changes the signed-in friend's username (handle). The handle lives at the URL
// root, so it must be unique and not collide with a reserved route. Identity is
// the cookie, never the URL — a friend can only rename themselves. Their login
// session (friend_token = access_token) is unaffected, so no re-auth is needed.
export async function changeUsername(
  next: string,
): Promise<{ ok: boolean; error?: string; handle?: string }> {
  const friend = await getCurrentFriend();
  if (!friend) return { ok: false, error: "Open your personal invite link first." };

  const handle = next.trim().toLowerCase();
  if (!handle || handle === friend.handle)
    return { ok: false, error: "That's already your username." };

  const err = usernameError(handle);
  if (err === "format")
    return { ok: false, error: "3–20 characters: lowercase letters, numbers, dashes." };
  if (err === "reserved") return { ok: false, error: "That username isn't available." };

  const sb = createAdminClient();
  const { data: taken } = await sb
    .from("friends")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (taken) return { ok: false, error: "That username is taken." };

  const { error } = await sb.from("friends").update({ handle }).eq("id", friend.id);
  // A concurrent rename to the same handle trips the friends.handle unique index.
  if (error?.code === "23505") return { ok: false, error: "That username is taken." };
  if (error) return { ok: false, error: error.message };

  if (friend.handle) revalidatePath(`/${friend.handle}`, "layout");
  revalidatePath(`/${handle}`, "layout");
  return { ok: true, handle };
}
