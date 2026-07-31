import Link from "next/link";

// Shared chrome for every /admin page: quick nav to the inbox, catalog tools,
// and a "view the shop as a user" jump (admin sessions can open any /[handle]).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
          <Link
            href="/admin"
            className="text-sm font-semibold tracking-tight"
          >
            HaulHQ
          </Link>
          <nav className="flex gap-5 text-[11px] uppercase tracking-tight text-neutral-500">
            <Link href="/admin/inbox" className="hover:text-black">
              Inbox
            </Link>
            <Link href="/admin/products" className="hover:text-black">
              Products
            </Link>
            <Link href="/admin" className="hover:text-black">
              Friends
            </Link>
            <Link href="/hampus/shop" className="hover:text-black">
              View shop →
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
