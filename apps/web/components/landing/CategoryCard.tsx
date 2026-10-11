import Link from "next/link";
import type { CategoryNode } from "@/lib/api-shapes";
import { categoryIcon } from "@/lib/category-icons";

export function CategoryCard({ category }: { category: CategoryNode }) {
  return (
    <Link
      href={`/products?category=${encodeURIComponent(category.slug)}`}
      className="flex w-[140px] shrink-0 flex-col items-center gap-2 rounded-md border border-line bg-card px-4 py-6 text-center transition-colors hover:border-teal sm:w-auto"
    >
      <span className="material-symbols-outlined text-[28px] text-teal">
        {categoryIcon(category.slug)}
      </span>
      <span className="text-sm font-semibold">{category.name}</span>
    </Link>
  );
}
