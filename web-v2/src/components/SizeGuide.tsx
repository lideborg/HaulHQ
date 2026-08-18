"use client";

import { useState } from "react";
import type { SizeGuide as SizeGuideData } from "@/lib/types";

const LABELS: Record<string, string> = {
  pit_to_pit: "Chest (pit to pit)",
  bust: "Bust",
  chest: "Chest",
  half_waist: "Waist (half)",
  waist: "Waist",
  hip: "Hip",
  length: "Length",
  outer_length: "Outer length",
  shoulder: "Shoulder",
  sleeve: "Sleeve",
  thigh: "Thigh",
};

function label(key: string) {
  return (
    LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Stored values are in guide.unit; convert only when displaying the other unit.
// A cell can be a string range (e.g. an elastic waist "78-90") — pass those
// through unchanged rather than coercing to NaN on unit toggle.
function display(v: number | string | null, from: "cm" | "in", to: "cm" | "in") {
  if (v == null) return "—";
  if (typeof v !== "number" || from === to) return String(v);
  const converted = from === "cm" ? v / 2.54 : v * 2.54;
  return (Math.round(converted * 10) / 10).toFixed(1);
}

export function SizeGuide({ guide }: { guide: SizeGuideData }) {
  const source = guide.unit === "in" ? "in" : "cm";
  const [unit, setUnit] = useState<"cm" | "in">(source);
  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest">
          Size guide
        </p>
        <div className="flex gap-1 text-[11px]">
          {(["cm", "in"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`border px-2 py-0.5 uppercase ${
                unit === u ? "border-black bg-black text-white" : "border-neutral-300"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-neutral-200 text-left">
            <th className="py-1.5 pr-2 font-normal text-neutral-500"> </th>
            {guide.sizes.map((s) => (
              <th key={s} className="py-1.5 pr-2 font-semibold">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(guide.measurements).map(([key, vals]) => (
            <tr key={key} className="border-b border-neutral-100">
              <td className="py-1.5 pr-2 text-neutral-500">{label(key)}</td>
              {guide.sizes.map((_, i) => (
                <td key={i} className="py-1.5 pr-2">{display(vals[i] ?? null, source, unit)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {guide.note && (
        <p className="mt-2 text-[10px] text-neutral-400">{guide.note}</p>
      )}
    </div>
  );
}
