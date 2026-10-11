import Link from "next/link";
import type { CategoryNode } from "@/lib/api-shapes";
import { categoryIcon } from "@/lib/category-icons";

export function CategoryCard({ category }: { category: CategoryNode }) {
  return (
    <Link
      href={`/products?category=${encodeURIComponent(category.slug)}`}
      className="group flex w-[140px] shrink-0 flex-col items-center rounded-xl border border-line bg-surface-container-lowest p-6 text-center transition-all hover:border-teal hover:shadow-md sm:w-auto"
    >
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-teal transition-colors group-hover:bg-teal group-hover:text-white">
        <span className="material-symbols-outlined text-[24px]">{categoryIcon(category.slug)}</span>
      </div>
      <span className="text-sm font-bold leading-tight">{category.name}</span>
    </Link>
  );
}
