import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const img = product.image_urls?.[0];
  const price =
    product.price_usd != null
      ? `US$ ${product.price_usd.toFixed(2)}`
      : "Quote on request";
  return (
    <div className="group block">
      <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={product.title}
            className="h-full w-full object-cover transition duration-300 group-hover:opacity-90"
          />
        ) : null}
      </div>
      <div className="mt-3 space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide">
          {product.brand}
        </p>
        <p className="line-clamp-1 text-[11px] text-neutral-500">
          {product.title}
        </p>
        <p className="text-[11px]">{price}</p>
      </div>
    </div>
  );
}
