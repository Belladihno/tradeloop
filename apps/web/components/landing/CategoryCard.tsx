import Link from "next/link";

export interface CategoryNode {
  id: string;
  name: string;
  children: CategoryNode[];
}

const ICONS = ["smartphone", "laptop", "checkroom", "headphones", "solar_power", "home"] as const;

export function CategoryCard({ category, index }: { category: CategoryNode; index: number }) {
  return (
    <Link
      href={`/products?category=${encodeURIComponent(category.name)}`}
      className="flex flex-col items-center gap-2 rounded-md border border-line bg-card px-4 py-6 text-center transition-colors hover:border-teal"
    >
      <span className="material-symbols-outlined text-[28px] text-teal">
        {ICONS[index % ICONS.length]}
      </span>
      <span className="text-sm font-semibold">{category.name}</span>
    </Link>
  );
}
