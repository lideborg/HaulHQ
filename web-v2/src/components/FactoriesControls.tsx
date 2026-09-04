"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { addLinkToHaul } from "@/app/(friend)/factories/actions";
import { LiveSearch } from "./LiveSearch";

export function FactorySearch({ initial }: { initial: string }) {
  return (
    <div className="mt-8">
      <LiveSearch
        basePath="/factories"
        initial={initial}
        placeholder="Search any brand, e.g. Prada"
        className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
    </div>
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

export function AddLinkForm() {
  // Size is required so admin always gets a size intent. Bags/belts/accessories
  // that have no size tick "One size" instead, which submits size "One size".
  const [oneSize, setOneSize] = useState(false);
  return (
    <form action={addLinkToHaul} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          name="link"
          required
          placeholder="Paste the product link"
          className="w-full border border-neutral-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        {oneSize ? (
          <input type="hidden" name="size" value="One size" />
        ) : (
          <input
            type="text"
            name="size"
            required
            placeholder="Size"
            spellCheck={false}
            autoComplete="off"
            className="w-24 shrink-0 border border-neutral-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
        )}
        <AddButton />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-neutral-500">
        <input
          type="checkbox"
          checked={oneSize}
          onChange={(e) => setOneSize(e.target.checked)}
          className="h-3 w-3"
        />
        One size / no size (bag, belt, accessory)
      </label>
    </form>
  );
}
