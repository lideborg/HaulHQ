import Link from "next/link";
import { notFound } from "next/navigation";
import { getFriendByHandle } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FriendHomePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getFriendByHandle(handle);
  if (!friend) notFound();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome 👋
      </h1>
      <Link
        href={`/${handle}/shop`}
        className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black"
      >
        Browse the shop →
      </Link>
    </div>
  );
}
