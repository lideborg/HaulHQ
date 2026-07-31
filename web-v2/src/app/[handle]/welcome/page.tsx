import { notFound, redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentFriend } from "@/lib/friend";
import { isAdmin } from "@/lib/adminAuth";
import { getFriendByHandle } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getCurrentFriend();
  const own = friend != null && friend.handle === handle;
  // Admin may preview any friend's onboarding screen (to troubleshoot);
  // an actual friend who is already onboarded skips it and goes to the shop.
  if (!own && !(await isAdmin())) redirect("/login");
  if (own && friend.onboarded_at) redirect(`/${handle}/shop`);
  const viewed = own ? friend : await getFriendByHandle(handle);
  if (!viewed) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold tracking-tight">Welcome.</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        This is a small, invite-only shop of pieces that have been hunted down
        and quality-checked. Everything is ordered together in group hauls, so
        prices stay low and shipping is shared.
      </p>
      <div className="mt-10">
        <ProfileForm
          handle={handle}
          mode="welcome"
          initialAddress={viewed.shipping_address}
          initialMeasurements={viewed.measurements}
        />
      </div>
    </div>
  );
}
