"use client";

// Tiny context for opening / closing the ItemModal from anywhere in the
// catalog or haul views. Single global modal — no nested stacks needed.

import { createContext, useCallback, useContext, useState } from "react";
import type { Item } from "@/types/catalog";
import { ItemModal } from "./ItemModal";

interface ModalApi {
  open: (item: Item) => void;
  close: () => void;
  active: Item | null;
}

const Ctx = createContext<ModalApi | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Item | null>(null);
  const open = useCallback((item: Item) => setActive(item), []);
  const close = useCallback(() => setActive(null), []);

  return (
    <Ctx.Provider value={{ open, close, active }}>
      {children}
      <ItemModal item={active} onClose={close} />
    </Ctx.Provider>
  );
}

export function useModal(): ModalApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModal must be used inside <ModalProvider>");
  return ctx;
}
