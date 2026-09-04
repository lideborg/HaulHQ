import { redirect } from "next/navigation";
import { FriendHeader } from "@/components/FriendHeader";
import { getViewer } from "@/lib/viewer";
import { getHaulCount } from "@/lib/data";
import { exitViewAs } from "@/app/admin/view-actions";

// The whole friend surface is private to the signed-in friend: identity comes
// from the friend_token cookie (or an admin view_as session), never from the
// URL. Legacy friends who predate email login are gated to add one before
// anything else — email is the login credential now.
export default async function FriendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { friend, viewingAs } = viewer;
  if (!friend.email && !viewingAs) redirect("/account/email");

  const haulCount = await getHaulCount(friend.id);

  return (
    <>
      {viewingAs && (
        <div className="flex items-center justify-between bg-amber-100 px-4 py-1.5 text-[11px] text-amber-900">
          <span>
            Viewing as <strong>{friend.name}</strong>
          </span>
          <form action={exitViewAs}>
            <button className="underline">Exit</button>
          </form>
        </div>
      )}
      <FriendHeader haulCount={haulCount} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </>
  );
}
