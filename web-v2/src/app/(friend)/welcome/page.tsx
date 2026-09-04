import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { friend } = viewer;
  // A friend who is already onboarded skips straight to the shop; an admin
  // previewing (view-as) may always see the screen to troubleshoot.
  if (friend.onboarded_at && !viewer.viewingAs) redirect("/shop");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold tracking-tight">Welcome.</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        This is a small, invite-only shop of pieces that have been hunted down
        and quality-checked. Everything is ordered together in group hauls, so
        prices stay low and shipping is shared. You can always come back by
        signing in at haulhq.shop.
      </p>
      <div className="mt-10">
        <ProfileForm
          mode="welcome"
          initialAddress={friend.shipping_address}
          initialMeasurements={friend.measurements}
        />
      </div>
    </div>
  );
}
