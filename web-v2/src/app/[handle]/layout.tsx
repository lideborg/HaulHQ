import { redirect } from "next/navigation";
import { FriendHeader } from "@/components/FriendHeader";
import { getCurrentFriend } from "@/lib/friend";

// The whole /[handle] surface is private to the signed-in friend: identity
// comes from the friend_token cookie (set by /f/<token>), never from the URL —
// handles are guessable, so a handle-only lookup would let anyone read a
// friend's shop and haul.
export default async function FriendLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) redirect("/");

  return (
    <>
      <FriendHeader handle={handle} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </>
  );
}
