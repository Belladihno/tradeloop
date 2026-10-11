import { apiServer } from "@/lib/api-server";
import { rateLimitNotice } from "@/lib/api-notice";
import { asProductPage } from "@/lib/api-shapes";
import { ProductCard } from "@/components/domain/ProductCard";

function DealsEmpty({ notice }: { notice?: string }) {
  return (
    <div role="status" className="rounded-md border border-line bg-card px-4 py-10 text-center">
      <p className="text-sm font-semibold">{notice ?? "No deals yet"}</p>
      {!notice && (
        <p className="mt-1 text-[13px] text-ink-secondary">
          New products from verified sellers will appear here.
        </p>
      )}
    </div>
  );
}

export async function DealsGrid() {
  let items: ReturnType<typeof asProductPage>["items"] = [];
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    items = asProductPage(await apiServer(baseUrl).get("/products?limit=8&sort=newest")).items;
  } catch (error) {
    return <DealsEmpty notice={rateLimitNotice(error) ?? undefined} />;
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
