import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/admin";
import { getCurrentFriend } from "./friend";
import { isAdmin } from "./adminAuth";
import type { Friend } from "./types";

// Identity for the session-based friend surface (/shop, /haul, …).
// - Normally: the friend from the friend_token cookie.
// - Admin "view as": a valid admin session plus a view_as cookie (friend id)
//   resolves to that friend so the admin sees the shop exactly as they do.
// cache(): layout + page + actions all ask per request — one resolution.
export interface Viewer {
  friend: Friend;
  // Set when an admin is browsing as this friend (drives the exit banner).
  viewingAs: boolean;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (await isAdmin()) {
    const viewAs = (await cookies()).get("view_as")?.value;
    if (viewAs) {
      const sb = createAdminClient();
      const { data } = await sb
        .from("friends")
        .select("*")
        .eq("id", viewAs)
        .eq("active", true)
        .maybeSingle();
      if (data) return { friend: data as Friend, viewingAs: true };
    }
  }
  const friend = await getCurrentFriend();
  return friend ? { friend, viewingAs: false } : null;
});
