export const dynamic = "force-static";

export default function SplashPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-white p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero.png"
        alt="HaulHQ — invite only"
        className="block w-full max-w-[724px]"
      />
    </main>
  );
}
