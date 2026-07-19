import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/admin";
import type { Friend } from "./types";

// Current friend, resolved from the `friend_token` cookie set by /f/<token>.
// Returns null when no valid token is present — callers must treat that as
// "not signed in" rather than defaulting to another identity.
export async function getCurrentFriend(): Promise<Friend | null> {
  const token = (await cookies()).get("friend_token")?.value;
  if (!token) return null;
  const sb = createAdminClient();
  const { data } = await sb
    .from("friends")
    .select("*")
    .eq("access_token", token)
    .eq("active", true)
    .maybeSingle();
  return (data as Friend) ?? null;
}
