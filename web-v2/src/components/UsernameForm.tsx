"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeUsername } from "@/app/[handle]/profile-actions";

// A friend's handle is their login and their public link, so renames are
// gated behind a confirm() prompt — no accidental or constant changes.
export function UsernameForm({ current }: { current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const next = value.trim().toLowerCase();
    if (!next || next === current) {
      setError("That's already your username.");
      return;
    }
    start(async () => {
      const res = await changeUsername(next, current);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      router.push(`/${res.handle}/profile`);
      router.refresh();
    });
  }

  return (
    <section className="mt-10 border-t border-neutral-100 pt-6">
      <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-widest">
        Username
      </h2>
      <p className="mb-3 text-xs text-neutral-500">
        Your login and your link (haulhq.shop/
        <span className="text-neutral-800">{current}</span>). Changing it updates
        everywhere.
      </p>
      <div className="flex gap-2">
        <input
          className="w-full border border-neutral-300 px-2 py-1.5 text-sm lowercase focus:border-black focus:outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="whitespace-nowrap border border-black px-4 py-1.5 text-[10px] uppercase tracking-widest transition hover:bg-black hover:text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Change"}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
    </section>
  );
}
