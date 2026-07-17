import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { AddToCart } from "@/components/AddToCart";
import { getProductById } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const price =
    product.price_usd != null
      ? `US$ ${product.price_usd.toFixed(2)}`
      : "Quote on request";

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-[1100px] gap-10 px-6 py-8 md:grid-cols-2">
        <div className="space-y-3">
          {product.image_urls?.length ? (
            product.image_urls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={u}
                alt={product.title}
                className="w-full bg-neutral-100 object-cover"
              />
            ))
          ) : (
            <div className="aspect-[3/4] bg-neutral-100" />
          )}
        </div>

        <div className="self-start md:sticky md:top-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest">
              {product.brand}
            </p>
            <p className="text-sm text-neutral-600">{product.title}</p>
            <p className="text-sm">{price}</p>
            {product.description && (
              <p className="text-xs leading-relaxed text-neutral-500">
                {product.description}
              </p>
            )}
          </div>
          <div className="mt-6">
            <AddToCart productId={product.id} sizes={product.size_options ?? []} />
          </div>
        </div>
      </main>
    </>
  );
}
