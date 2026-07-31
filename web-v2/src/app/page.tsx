import Link from "next/link";

export const dynamic = "force-static";

export default function SplashPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 bg-white p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero.png"
        alt="HaulHQ — invite only"
        className="block w-full max-w-[724px]"
      />
      <Link
        href="/login"
        className="border border-black px-8 py-3 text-[11px] uppercase tracking-widest transition hover:bg-black hover:text-white"
      >
        Log in
      </Link>
    </main>
  );
}
