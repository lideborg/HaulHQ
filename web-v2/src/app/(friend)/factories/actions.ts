"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/viewer";
import { classifySourceLink } from "@/lib/sourceLink";
import { resolveSourcingItem } from "@/lib/sourcing";
import { getOrCreateOpenHaul } from "@/lib/data";

// Instant insert, background enrichment (spec §4). The item shows up in the
// haul as "sourcing" before the response even lands; after() finishes the
// title/image/price lookup once the redirect has been sent.
export async function addLinkToHaul(formData: FormData) {
  const raw = String(formData.get("link") ?? "").trim();
  // Size is required (the form enforces it too); bags/accessories submit
  // "One size". Guard here so a size intent is always captured server-side.
  const size = String(formData.get("size") ?? "").trim();
  const src = classifySourceLink(raw);
  if (!src) redirect("/factories?error=link");
  if (!size) redirect("/factories?error=size");

  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { friend } = viewer;

  const sb = createAdminClient();
  const openHaul = await getOrCreateOpenHaul(sb, friend.id);
  const { data: item, error } = await sb
    .from("items")
    .insert({
      owner_id: friend.id,
      haul_id: openHaul.id,
      source_link: src.url,
      chosen_size: size,
      status: "sourcing",
    })
    .select("id")
    .single();
  if (error || !item) redirect("/factories?error=save");

  await sb.from("notifications").insert({
    kind: "new_request",
    item_id: item.id,
    friend_id: friend.id,
    payload: { link: src.url, size, friend: friend.name, via: "factories" },
  });
  await sb.from("status_events").insert({
    item_id: item.id,
    status: "sourcing",
    note: "Link added from Factories",
  });

  after(() => resolveSourcingItem(item.id));

  revalidatePath("/haul");
  redirect("/factories?added=1");
}
