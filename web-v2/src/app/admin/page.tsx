import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const sb = createAdminClient();
  const [{ count: products }, { count: pub }, { count: requests }] =
    await Promise.all([
      sb.from("products").select("*", { count: "exact", head: true }),
      sb.from("products").select("*", { count: "exact", head: true }).eq("published", true),
      sb.from("items").select("*", { count: "exact", head: true }).eq("status", "requested"),
    ]);
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="mb-8 text-sm font-semibold uppercase tracking-[0.25em]">
        HaulHQ — HQ
      </h1>
      <div className="flex gap-10 text-sm">
        <p>{products ?? 0} products ({pub ?? 0} visible)</p>
        <p>{requests ?? 0} open requests</p>
      </div>
    </main>
  );
}
