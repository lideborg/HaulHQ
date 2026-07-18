import { notFound } from "next/navigation";
import { FriendHeader } from "@/components/FriendHeader";
import { getFriendByHandle } from "@/lib/data";

export default async function FriendLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getFriendByHandle(handle);
  if (!friend) notFound();

  return (
    <>
      <FriendHeader handle={handle} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </>
  );
}
