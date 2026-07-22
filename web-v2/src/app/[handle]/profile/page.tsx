import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentFriend } from "@/lib/friend";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) redirect(`/${handle}/shop`);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold tracking-tight">Your profile</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Delivery address and sizing — used for your orders and size
        recommendations. Everything here is optional.
      </p>
      <div className="mt-8">
        <ProfileForm
          handle={handle}
          mode="profile"
          initialAddress={friend.shipping_address}
          initialMeasurements={friend.measurements}
        />
      </div>
    </div>
  );
}
