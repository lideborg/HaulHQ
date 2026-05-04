"use client";

// Toolbar for bulk wishlist operations: select-all (visible items),
// clear, export to JSON, import from JSON.

import { useRef, useState } from "react";
import { useWishlist } from "@/lib/useWishlist";
import type { Item } from "@/types/catalog";

export interface BulkActionsProps {
  visibleItems: Item[];
}

export function BulkActions({ visibleItems }: BulkActionsProps) {
  const { count, addAll, clear, wishlist, setAll } = useWishlist();
  const fileInput = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify([...wishlist], null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `haul-wishlist-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportClick = () => fileInput.current?.click();
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || !parsed.every((k) => typeof k === "string")) {
        throw new Error("Expected JSON array of string keys");
      }
      const incoming = parsed as string[];
      const merge = window.confirm(
        `Import ${incoming.length} favorites?\n\nOK = merge with current ${count}\nCancel = replace current with imported`
      );
      const next = merge ? [...new Set([...wishlist, ...incoming])] : incoming;
      setAll(next);
      flash(`Imported ${incoming.length} (${merge ? "merged" : "replaced"})`);
    } catch (err) {
      console.warn("import failed:", err);
      flash("Import failed — see console");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <nav className="mt-3 inline-flex flex-wrap items-center justify-center gap-1.5">
      <BulkBtn
        onClick={() => addAll(visibleItems)}
        icon={
          <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden="true">
            <path d="M3 8l3 3 7-7-1.4-1.4L6 8.2 4.4 6.6z" />
          </svg>
        }
      >
        Select all visible
      </BulkBtn>
      <BulkBtn
        onClick={() => {
          if (count === 0) return;
          if (window.confirm(`Clear all ${count} items from your haul?`)) clear();
        }}
        icon={
          <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        }
      >
        Clear haul
      </BulkBtn>
      <BulkBtn ghost onClick={onExport} title="Download your favorites as JSON">
        Export
      </BulkBtn>
      <BulkBtn ghost onClick={onImportClick} title="Restore a wishlist from JSON">
        Import
      </BulkBtn>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        onChange={onFileChosen}
        className="hidden"
      />
      {toast ? (
        <span className="ml-2 text-[12px] text-emerald-700">{toast}</span>
      ) : null}
    </nav>
  );
}

function BulkBtn({
  children,
  icon,
  ghost,
  ...rest
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  ghost?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
        ghost
          ? "border-(--color-border) bg-transparent text-neutral-600 hover:border-(--color-fg) hover:text-(--color-fg)"
          : "border-(--color-fg) bg-(--color-fg) text-white hover:bg-neutral-800",
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}
