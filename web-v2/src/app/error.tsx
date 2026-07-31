"use client";

// Root error boundary — catches uncaught errors in any route below the root
// layout (e.g. a Supabase read that throws) and offers a retry instead of
// dropping the visitor onto Next's unstyled crash screen.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-lg font-medium">Something went wrong</h1>
      <p className="text-sm text-neutral-500">
        We hit a snag loading this page. Try again in a moment. If it
        keeps happening, message Hampus.
      </p>
      <button
        onClick={reset}
        className="rounded-full border border-neutral-300 px-5 py-2 text-sm transition hover:bg-neutral-100"
      >
        Try again
      </button>
    </div>
  );
}
