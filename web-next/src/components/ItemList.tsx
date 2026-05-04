// Renders a list of items in either grid, list, or compact layout.
// Server-importable; the underlying Card / ListRow / CompactTile are
// client components.

import type { Item } from "@/types/catalog";
import type { ViewMode } from "@/lib/filters";
import { Card } from "./Card";
import { ListRow } from "./ListRow";
import { CompactTile } from "./CompactTile";

export interface ItemListProps {
  items: Item[];
  view: ViewMode;
  emptyText?: string;
}

export function ItemList({ items, view, emptyText = "No items match the current filter." }: ItemListProps) {
  if (items.length === 0) {
    return <div className="py-16 text-center text-(--color-muted)">{emptyText}</div>;
  }
  if (view === "list") {
    return (
      <div className="border-t border-(--color-border)">
        {items.map((item) => (
          <ListRow key={`${item._dir}-${item._slug}`} item={item} />
        ))}
      </div>
    );
  }
  if (view === "compact") {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <CompactTile key={`${item._dir}-${item._slug}`} item={item} />
        ))}
      </div>
    );
  }
  // grid (default)
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={`${item._dir}-${item._slug}`} item={item} />
      ))}
    </div>
  );
}
