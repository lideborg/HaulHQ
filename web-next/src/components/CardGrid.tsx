// Plain grid of <Card>s. Replaces the old ItemList dispatcher now that the
// view-mode toggle is gone — Grid is the only layout.

import type { Item } from "@/types/catalog";
import { Card } from "./Card";

export interface CardGridProps {
  items: Item[];
  emptyText?: string;
}

export function CardGrid({
  items,
  emptyText = "No items match the current filter.",
}: CardGridProps) {
  if (items.length === 0) {
    return <div className="py-16 text-center text-(--color-muted)">{emptyText}</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={`${item._dir}-${item._slug}`} item={item} />
      ))}
    </div>
  );
}
