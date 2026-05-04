import { Suspense } from "react";
import { Header } from "@/components/Header";
import { HaulClient } from "@/components/HaulClient";
import { loadAllItems } from "@/lib/data";
import { loadShippingData } from "@/lib/shipping.server";

export const dynamic = "force-static";

export default async function HaulPage() {
  const [items, shippingData] = await Promise.all([
    loadAllItems(),
    loadShippingData(),
  ]);
  return (
    <>
      <Header active="haul" />
      <Suspense>
        <HaulClient items={items} shippingData={shippingData} />
      </Suspense>
    </>
  );
}
