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
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="relative w-full max-w-[724px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-clean.png" alt="" className="block w-full" />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Link
            href={`/${handle}/shop`}
            className="border border-white px-8 py-3 text-[11px] uppercase tracking-widest text-white transition hover:bg-white hover:text-black"
          >
            Browse the shop
          </Link>
        </div>
      </div>
    </div>
  );
}
