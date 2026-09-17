import Link from "next/link";

// Rendered for notFound() calls (unknown route, missing product, etc.).
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-lg font-medium">Page not found</h1>
      <p className="text-sm text-neutral-500">
        This link may be broken, or the item is no longer available. If
        something seems off, message the admin.
      </p>
      <Link
        href="/"
        className="rounded-full border border-neutral-300 px-5 py-2 text-sm transition hover:bg-neutral-100"
      >
        Go home
      </Link>
    </div>
  );
}
