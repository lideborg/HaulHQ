import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          HaulHQ.shop
        </Link>
      </div>
    </header>
  );
}
