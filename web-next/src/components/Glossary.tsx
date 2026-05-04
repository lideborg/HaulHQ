"use client";

// Searchable glossary of brand abbreviations + community terminology.

import { useMemo, useState } from "react";
import type { GlossaryFile } from "@/types/notes";

export function Glossary({ data }: { data: GlossaryFile }) {
  const [q, setQ] = useState("");
  const lower = q.toLowerCase().trim();

  const abbrevs = useMemo(
    () =>
      data.abbreviations.filter(
        (a) =>
          !lower ||
          a.abbr.toLowerCase().includes(lower) ||
          a.brand.toLowerCase().includes(lower) ||
          (a.notes ?? "").toLowerCase().includes(lower)
      ),
    [data.abbreviations, lower]
  );
  const terms = useMemo(
    () =>
      data.terminology.filter(
        (t) =>
          !lower ||
          t.term.toLowerCase().includes(lower) ||
          t.meaning.toLowerCase().includes(lower)
      ),
    [data.terminology, lower]
  );

  return (
    <section className="mt-16">
      <h2 className="m-0 mb-4 border-b border-(--color-fg) pb-3 text-[14px] font-medium uppercase tracking-[0.16em]">
        Glossary
      </h2>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search brands, abbreviations, terms…"
        className="mb-6 w-full max-w-[380px] border border-(--color-border) bg-white px-3.5 py-2.5 text-[13px] focus:border-(--color-fg) focus:outline-none"
      />

      <h3 className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-(--color-muted)">
        Brand abbreviations · {abbrevs.length}
      </h3>
      <table className="mb-8 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-(--color-border)">
            <Th>Abbr</Th>
            <Th>Brand</Th>
            <Th>Category</Th>
            <Th>Notes</Th>
          </tr>
        </thead>
        <tbody>
          {abbrevs.map((a) => (
            <tr key={a.abbr} className="border-b border-(--color-border)">
              <Td className="font-medium">{a.abbr}</Td>
              <Td>{a.brand}</Td>
              <Td className="text-(--color-muted)">{a.category}</Td>
              <Td className="text-(--color-muted)">{a.notes}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-(--color-muted)">
        Community terminology · {terms.length}
      </h3>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-(--color-border)">
            <Th>Term</Th>
            <Th>Meaning</Th>
          </tr>
        </thead>
        <tbody>
          {terms.map((t) => (
            <tr key={t.term} className="border-b border-(--color-border)">
              <Td className="font-medium">{t.term}</Td>
              <Td>{t.meaning}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="p-2.5 text-left text-[10px] font-normal uppercase tracking-[0.1em] text-(--color-muted)">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`p-2.5 align-top ${className}`}>{children}</td>;
}
