import Link from "next/link";

export function FriendHeader({
  handle,
  haulCount,
}: {
  handle: string;
  haulCount: number;
}) {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
        <Link
          href={`/${handle}`}
          className="text-sm font-semibold tracking-tight"
        >
          HaulHQ.shop
        </Link>
        <nav className="flex gap-6 text-[11px] uppercase tracking-widest text-neutral-500">
          <Link href={`/${handle}/shop`} className="hover:text-black">
            Shop
          </Link>
          <Link href={`/${handle}/factories`} className="hover:text-black">
            Factories
          </Link>
          <Link href={`/${handle}/profile`} className="hover:text-black">
            Profile
          </Link>
          <Link href={`/${handle}/haul`} className="hover:text-black">
            Haul{haulCount > 0 ? ` (${haulCount})` : ""}
          </Link>
        </nav>
      </div>
    </header>
  );
}
