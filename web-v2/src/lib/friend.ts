import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/admin";
import type { Friend } from "./types";

// Current friend from the `friend_token` cookie. Falls back to the first friend
// (demo) so the flow is testable before per-friend links are handed out.
export async function getCurrentFriend(): Promise<Friend | null> {
  const sb = createAdminClient();
  const token = (await cookies()).get("friend_token")?.value;
  if (token) {
    const { data } = await sb
      .from("friends")
      .select("*")
      .eq("access_token", token)
      .eq("active", true)
      .maybeSingle();
    if (data) return data as Friend;
  }
  const { data } = await sb
    .from("friends")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as Friend) ?? null;
}
