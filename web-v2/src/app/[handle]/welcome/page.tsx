import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentFriend } from "@/lib/friend";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getCurrentFriend();
  // Admin previews and already-onboarded friends go straight to the shop.
  if (!friend || friend.handle !== handle) redirect(`/${handle}/shop`);

  const firstName = friend.name?.split(" ")[0] ?? "there";
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold tracking-tight">Hi {firstName} — welcome.</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        This is a small, invite-only shop of pieces that have been hunted down
        and quality-checked. Everything is ordered together in group hauls, so
        prices stay low and shipping is shared.
      </p>
      <div className="mt-10">
        <ProfileForm
          handle={handle}
          mode="welcome"
          initialAddress={friend.shipping_address}
          initialMeasurements={friend.measurements}
        />
      </div>
    </div>
  );
}
