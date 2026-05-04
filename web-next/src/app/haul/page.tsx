import { Suspense } from "react";
import { Header } from "@/components/Header";
import { HaulClient } from "@/components/HaulClient";
import { loadAllItems } from "@/lib/data";
import { loadShippingData } from "@/lib/shipping.server";
import { loadSellerMessages } from "@/lib/notes";

export const dynamic = "force-static";

export default async function HaulPage() {
  const [items, shippingData, sellerMessages] = await Promise.all([
    loadAllItems(),
    loadShippingData(),
    loadSellerMessages(),
  ]);
  return (
    <>
      <Header active="haul" />
      <Suspense>
        <HaulClient
          items={items}
          shippingData={shippingData}
          sellerMessages={sellerMessages}
        />
      </Suspense>
    </>
  );
}
