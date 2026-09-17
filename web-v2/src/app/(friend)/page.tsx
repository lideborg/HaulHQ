import Link from "next/link";

export const dynamic = "force-dynamic";

// The layout has already resolved the viewer (or redirected to /login), so the
// landing hero needs no identity of its own.
export default function FriendHomePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="relative w-full max-w-[724px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-clean.png" alt="" className="block w-full" />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Link
            href="/shop"
            className="border border-white px-8 py-3 text-[11px] uppercase tracking-widest text-white transition hover:bg-white hover:text-black"
          >
            Browse the shop
          </Link>
        </div>
      </div>
    </div>
  );
}
