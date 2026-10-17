import { categoryIcon } from "@/lib/category-icons";

export function CategoryIcon({ slug }: { slug: string }) {
  return (
    <span className="material-symbols-outlined text-[20px] text-teal">{categoryIcon(slug)}</span>
  );
}
