import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { logout } from "@/app/login/actions";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { friend, viewingAs } = viewer;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold tracking-tight">Your profile</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Delivery address and sizing — used for your orders and size
        recommendations. Everything here is optional.
      </p>
      <div className="mt-8">
        <ProfileForm
          mode="profile"
          initialAddress={friend.shipping_address}
          initialMeasurements={friend.measurements}
        />
      </div>
      {/* An admin viewing as a friend has no friend_token to clear. */}
      {!viewingAs && (
        <form action={logout} className="mt-10 border-t border-neutral-100 pt-6">
          <button className="text-[11px] uppercase tracking-widest text-neutral-400 hover:text-black">
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
