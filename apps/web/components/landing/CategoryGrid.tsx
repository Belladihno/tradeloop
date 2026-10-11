import { apiServer } from "@/lib/api-server";
import { rateLimitNotice } from "@/lib/api-notice";
import { asCategoryList, type CategoryNode } from "@/lib/api-shapes";
import { CategoryCard } from "./CategoryCard";

function CategoryEmpty({ notice }: { notice?: string }) {
  return (
    <div role="status" className="rounded-md border border-line bg-card px-4 py-10 text-center">
      <p className="text-sm font-semibold">{notice ?? "No categories yet"}</p>
      {!notice && (
        <p className="mt-1 text-[13px] text-ink-secondary">
          Categories will appear here once the marketplace is stocked.
        </p>
      )}
    </div>
  );
}

export async function CategoryGrid() {
  let categories: CategoryNode[] = [];
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    categories = asCategoryList(await apiServer(baseUrl).get("/categories"));
  } catch (error) {
    return <CategoryEmpty notice={rateLimitNotice(error) ?? undefined} />;
  }
  if (categories.length === 0) return <CategoryEmpty />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.slice(0, 6).map((category, i) => (
        <CategoryCard key={category.id} category={category} index={i} />
      ))}
    </div>
  );
}
