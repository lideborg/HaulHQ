"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";

export async function submitRequest(formData: FormData) {
  const link = String(formData.get("link") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!/^https?:\/\//.test(link)) redirect("/request?error=link");

  const friend = await getCurrentFriend();
  if (!friend) redirect("/request?error=session");

  const sb = createAdminClient();
  const { data: item, error } = await sb
    .from("items")
    .insert({
      owner_id: friend.id,
      source_link: link,
      title: null,
      chosen_size: size,
      notes: note,
      status: "requested",
    })
    .select("id")
    .single();
  if (error) redirect("/request?error=save");

  await sb.from("notifications").insert({
    kind: "new_request",
    item_id: item.id,
    friend_id: friend.id,
    payload: { link, size, note, friend: friend.name },
  });
  await sb.from("status_events").insert({
    item_id: item.id,
    status: "requested",
    note: "Link submitted",
  });
  redirect("/request?ok=1");
}
