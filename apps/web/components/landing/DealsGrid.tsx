import { apiServer } from "@/lib/api-server";
import { ProductCard, type DealProduct } from "@/components/domain/ProductCard";

interface ProductPage {
  items: DealProduct[];
  nextCursor: string | null;
}

function DealsEmpty() {
  return (
    <div role="status" className="rounded-md border border-line bg-card px-4 py-10 text-center">
      <p className="text-sm font-semibold">No deals yet</p>
      <p className="mt-1 text-[13px] text-ink-secondary">
        New products from verified sellers will appear here.
      </p>
    </div>
  );
}

export async function DealsGrid() {
  let items: DealProduct[] = [];
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    const page = await apiServer(baseUrl).get<ProductPage>("/products?limit=8&sort=newest");
    items = page.items;
  } catch {
    return <DealsEmpty />;
  }
  if (items.length === 0) return <DealsEmpty />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
