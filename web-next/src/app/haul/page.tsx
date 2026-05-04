import { Suspense } from "react";
import { Header } from "@/components/Header";
import { HaulClient } from "@/components/HaulClient";
import { loadAllItems } from "@/lib/data";

export const dynamic = "force-static";

export default async function HaulPage() {
  const items = await loadAllItems();
  return (
    <>
      <Header active="haul" />
      <Suspense>
        <HaulClient items={items} />
      </Suspense>
    </>
  );
}
