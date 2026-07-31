import { notFound, redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { UsernameForm } from "@/components/UsernameForm";
import { logout } from "@/app/login/actions";
import { getCurrentFriend } from "@/lib/friend";
import { isAdmin } from "@/lib/adminAuth";
import { getFriendByHandle } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getCurrentFriend();
  const own = friend != null && friend.handle === handle;
  // The friend edits their own profile; an admin may view any friend's page
  // exactly as that friend sees it (to troubleshoot), same as shop/haul.
  if (!own && !(await isAdmin())) redirect("/login");
  const viewed = own ? friend : await getFriendByHandle(handle);
  if (!viewed) notFound();

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
          initialAddress={viewed.shipping_address}
          initialMeasurements={viewed.measurements}
        />
      </div>
      {viewed.handle && <UsernameForm current={viewed.handle} />}
      {own && (
        <form action={logout} className="mt-10 border-t border-neutral-100 pt-6">
          <button className="text-[11px] uppercase tracking-widest text-neutral-400 hover:text-black">
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
