"use client";

// Shipping & duty estimator. Lives at the bottom of the Haul tab.
// The ShippingData blob is loaded server-side and passed in as a prop;
// all calculation happens in lib/shipping (pure TS), so this component
// is just UI + state.

import { useMemo } from "react";
import type { ShippingData, WeightProfile } from "@/types/shipping";
import type { Item } from "@/types/catalog";
import { calc } from "@/lib/shipping";
import { priceCny } from "@/lib/items";
import { useShipPrefs } from "@/lib/useShipPrefs";

export interface ShippingPanelProps {
  data: ShippingData;
  items: Item[];
}

export function ShippingPanel({ data, items }: ShippingPanelProps) {
  const { prefs, update } = useShipPrefs();

  const result = useMemo(() => {
    const itemsCny = items.reduce((s, it) => s + priceCny(it), 0);
    return calc(data, {
      itemsCny,
      itemCategories: items.map((it) => it.category ?? null),
      lineId: prefs.lineId,
      weightProfile: prefs.weightProfile,
      declaredPct: prefs.declaredPct,
    });
  }, [data, items, prefs]);

  if (items.length === 0) return null;

  const isDdp =
    result.line.tariff_handling === "ddp" || result.line.tariff_handling === "tariffless";
  const fmtUsd = (n: number) => `$${n.toFixed(0)}`;
  const fmtKg = (n: number) => `${n.toFixed(2)} kg`;

  return (
    <section className="mx-auto mt-6 max-w-[800px] rounded-xl border border-(--color-border) bg-neutral-50 px-5 py-4">
      <h3 className="m-0 mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
        Shipping & Duty Estimate
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Line">
          <select
            value={prefs.lineId}
            onChange={(e) => update({ lineId: e.target.value })}
            className="w-full rounded-md border border-(--color-border) bg-white px-2.5 py-1.5 text-[13px]"
          >
            {data.lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label} ({l.transit_days[0]}–{l.transit_days[1]}d)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Weight profile">
          <select
            value={prefs.weightProfile}
            onChange={(e) => update({ weightProfile: e.target.value as WeightProfile })}
            className="w-full rounded-md border border-(--color-border) bg-white px-2.5 py-1.5 text-[13px]"
          >
            <option value="low">Low</option>
            <option value="typical">Typical</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Declared value (% of subtotal)">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={Math.round(prefs.declaredPct * 100)}
              onChange={(e) => {
                const pct = parseFloat(e.target.value);
                if (Number.isFinite(pct) && pct > 0) update({ declaredPct: pct / 100 });
              }}
              className="w-16 rounded-md border border-(--color-border) bg-white px-2.5 py-1.5 text-[13px]"
            />
            <span className="text-[12px] text-neutral-500">%</span>
          </div>
        </Field>
      </div>

      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
        <Row k="Item subtotal" v={fmtUsd(result.itemsUsd)} sub={`(${items.length} items)`} />
        <Row
          k="Weight (actual / charged)"
          v={`${fmtKg(result.actualKg)} / ${fmtKg(result.chargedKg)}`}
          sub={
            result.line.min_kg && result.billableKg === result.line.min_kg
              ? `floor: ${result.line.min_kg} kg`
              : undefined
          }
        />
        <Row
          k="Shipping (line)"
          v={fmtUsd(result.baseShipping)}
          sub={`${fmtKg(result.billableKg)} via ${result.line.label.split(" (")[0]}`}
        />
        <Row k="Agent fees" v={fmtUsd(result.fees)} sub="3% payment + repack" />
        {isDdp ? (
          <Row
            k="Duty / tariff"
            v={fmtUsd(0)}
            sub={
              result.line.tariff_handling === "ddp"
                ? "DDP — bundled into shipping"
                : "tariffless lane"
            }
          />
        ) : (
          <>
            <Row
              k="Declared value"
              v={fmtUsd(result.declaredUsd)}
              sub={`${Math.round(prefs.declaredPct * 100)}% of subtotal`}
            />
            <Row
              k="Duty / tariff (recipient)"
              v={fmtUsd(result.duty)}
              sub="blended rate by category"
            />
          </>
        )}
      </dl>

      <div className="mt-3 flex items-baseline justify-between border-t border-(--color-border) pt-3">
        <span className="text-[14px] text-neutral-700">Estimated all-in</span>
        <span className="text-[20px] font-semibold tabular-nums">{fmtUsd(result.totalUsd)}</span>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        Estimates ±10–15%.{" "}
        {isDdp
          ? "DDP / tariffless lines bundle (or under-declare) duty into shipping; the recipient typically sees no separate duty bill."
          : "Recipient-pays line: carrier will invoice duty at delivery based on the actual customs declaration."}
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-600">
      {label}
      {children}
    </label>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <>
      <dt className="text-neutral-600">{k}</dt>
      <dd className="m-0 font-medium tabular-nums">
        {v}
        {sub ? <span className="ml-2 text-[12px] font-normal text-neutral-400">{sub}</span> : null}
      </dd>
    </>
  );
}
