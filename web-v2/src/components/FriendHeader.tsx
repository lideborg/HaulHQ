import Link from "next/link";

export function FriendHeader({ haulCount }: { haulCount: number }) {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          HaulHQ.shop
        </Link>
        <nav className="flex flex-wrap gap-3 text-[11px] uppercase tracking-widest text-neutral-500 sm:gap-6">
          <Link href="/shop" className="hover:text-black">
            Shop
          </Link>
          <Link href="/factories" className="hover:text-black">
            Factories
          </Link>
          <Link href="/profile" className="hover:text-black">
            Profile
          </Link>
          <Link href="/haul" className="hover:text-black">
            Haul{haulCount > 0 ? ` (${haulCount})` : ""}
          </Link>
        </nav>
      </div>
    </header>
  );
}
