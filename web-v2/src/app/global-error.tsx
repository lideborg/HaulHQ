"use client";

// Catches errors thrown in the root layout itself, which error.tsx cannot.
// Must render its own <html>/<body>.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center antialiased">
        <h1 className="text-lg font-medium">Something went wrong</h1>
        <p className="text-sm text-neutral-500">
          Please refresh the page or try again shortly.
        </p>
        <button
          onClick={reset}
          className="rounded-full border border-neutral-300 px-5 py-2 text-sm"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
