// Grid wrapper around <Card>. Server component; cards are client.

import type { Item } from "@/types/catalog";
import { Card } from "./Card";

export function CatalogGrid({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-(--color-muted)">
        No items match the current filter.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={`${item._dir}-${item._slug}`} item={item} />
      ))}
    </div>
  );
}
