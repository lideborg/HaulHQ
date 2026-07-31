"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { addLinkToHaul } from "@/app/[handle]/factories/actions";

// Live search: the results are server-rendered, so typing just replaces the
// URL (debounced) and lets the server component re-render with the new q.
export function FactorySearch({
  handle,
  initial,
}: {
  handle: string;
  initial: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function go(next: string) {
    const q = next.trim();
    router.replace(
      q ? `/${handle}/factories?q=${encodeURIComponent(q)}` : `/${handle}/factories`,
      { scroll: false },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
      className="mt-8"
    >
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => go(next), 250);
        }}
        placeholder="Search any brand, e.g. Prada"
        spellCheck={false}
        className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
    </form>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="flex items-center gap-2 whitespace-nowrap border border-black px-4 py-2 text-[10px] uppercase tracking-widest transition hover:bg-black hover:text-white disabled:opacity-60 disabled:hover:bg-white disabled:hover:text-black"
    >
      {pending && (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-neutral-500 border-t-transparent" />
      )}
      {pending ? "Adding…" : "Add product"}
    </button>
  );
}

export function AddLinkForm({ handle }: { handle: string }) {
  return (
    <form action={addLinkToHaul.bind(null, handle)} className="flex gap-2">
      <input
        type="url"
        name="link"
        required
        placeholder="Paste the product link"
        className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      <AddButton />
    </form>
  );
}
