import Link from "next/link";
import { logout } from "@/app/login/actions";

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
          className="text-sm font-semibold uppercase tracking-[0.25em]"
        >
          HaulHQ
        </Link>
        <nav className="flex gap-6 text-[11px] uppercase tracking-widest text-neutral-500">
          <Link href={`/${handle}/shop`} className="hover:text-black">
            Shop
          </Link>
          <Link href={`/${handle}/haul`} className="hover:text-black">
            Haul{haulCount > 0 ? ` (${haulCount})` : ""}
          </Link>
          <Link href={`/${handle}/profile`} className="hover:text-black">
            Profile
          </Link>
          <form action={logout} className="inline">
            <button className="uppercase tracking-widest text-neutral-500 hover:text-black">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
