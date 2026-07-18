export const dynamic = "force-static";

export default function SplashPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-black px-6 text-center">
      <h1 className="text-4xl font-bold uppercase tracking-[0.35em] text-white sm:text-6xl sm:tracking-[0.45em]">
        HaulHQ
      </h1>
      <p className="mt-6 text-[11px] uppercase tracking-[0.3em] text-neutral-500">
        Invite only.
      </p>
    </main>
  );
}
