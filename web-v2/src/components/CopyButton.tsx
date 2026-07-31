"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard can be denied (http, permissions) - leave the text
          // selectable in the code block as the fallback.
        }
      }}
      className="shrink-0 border border-neutral-300 px-3 py-1 text-[10px] uppercase tracking-tight transition hover:border-black"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
