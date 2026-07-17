// Site header — logo + tab navigation. Server component (no state).
// The haul count badge is a tiny client subcomponent (HaulCountBadge)
// so we can read localStorage without making the whole header client-side.

import Link from "next/link";
import { HaulCountBadge } from "./HaulCountBadge";

export interface HeaderProps {
  active: "catalog" | "haul" | "notes" | "import";
}

const tabs = [
  { id: "catalog" as const, href: "/", label: "Browse" },
  { id: "haul" as const, href: "/haul", label: "Haul" },
  { id: "notes" as const, href: "/notes", label: "Notes" },
  { id: "import" as const, href: "/import", label: "Import" },
];

export function Header({ active }: HeaderProps) {
  return (
    <header className="border-b border-(--color-border) px-6 pt-14 pb-6 text-center">
      <div className="inline-flex items-center gap-4 text-[26px] font-medium uppercase tracking-[0.22em]">
        <TshirtIcon />
        <span>HAUL</span>
        <SneakerIcon />
      </div>
      <nav className="mt-6 flex justify-center">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={[
                "px-4 py-2 text-[11px] uppercase tracking-[0.16em] border-b transition-colors",
                isActive
                  ? "text-(--color-fg) border-(--color-fg)"
                  : "text-(--color-muted) border-transparent hover:text-(--color-fg)",
              ].join(" ")}
            >
              {t.label}
              {t.id === "haul" ? <HaulCountBadge /> : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function TshirtIcon() {
  return (
    <svg
      viewBox="0 0 28 24"
      width={26}
      height={22}
      aria-hidden="true"
      className="text-(--color-fg)"
    >
      <path
        d="M2 6 L9 2 L11 5 L17 5 L19 2 L26 6 L23 10 L21 9 L21 22 L7 22 L7 9 L5 10 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
    </svg>
  );
}

function SneakerIcon() {
  return (
    <svg
      viewBox="0 0 32 24"
      width={30}
      height={22}
      aria-hidden="true"
      className="text-(--color-fg)"
    >
      <path
        d="M2 16 L2 19 L30 19 L30 16 L26 14 L20 13 L15 9 L11 9 L11 13 L7 14 L2 14 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
      <path d="M2 14 L30 14" fill="none" stroke="currentColor" strokeWidth={1} />
      <path
        d="M11 13 L15 13 M13 9 L13 13"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
    </svg>
  );
}
