import { redirect } from "next/navigation";
import { FriendHeader } from "@/components/FriendHeader";
import { getCurrentFriend } from "@/lib/friend";
import { isAdmin } from "@/lib/adminAuth";

// The whole /[handle] surface is private to the signed-in friend: identity
// comes from the friend_token cookie (set by /f/<token>), never from the URL —
// handles are guessable, so a handle-only lookup would let anyone read a
// friend's shop and haul. A valid admin session may view any friend's surface
// (Hampus browsing the shop as his friends see it).
export default async function FriendLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getCurrentFriend();
  const authorized = (friend && friend.handle === handle) || (await isAdmin());
  if (!authorized) redirect("/");

  return (
    <>
      <FriendHeader handle={handle} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </>
  );
}
