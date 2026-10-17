import Link from "next/link";
import type { CatalogParams } from "@/lib/catalog-params";
import { paramHref } from "@/lib/catalog-params";

const VIEWS = [
  { value: "grid", icon: "grid_view", label: "Grid view" },
  { value: "list", icon: "view_list", label: "List view" },
] as const;

export function ViewToggle({ params }: { params: CatalogParams }) {
  const active = params.view === "list" ? "list" : "grid";
  return (
    <div role="group" aria-label="View mode" className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
      {VIEWS.map((view) => (
        <Link
          key={view.value}
          href={paramHref(params, { view: view.value === "grid" ? "" : view.value, cursor: "" })}
          aria-label={view.label}
          aria-current={active === view.value ? "true" : undefined}
          className={`flex items-center rounded-md px-2 py-1.5 transition-colors ${
            active === view.value ? "bg-teal text-white" : "text-ink-secondary hover:text-teal"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{view.icon}</span>
        </Link>
      ))}
    </div>
  );
}
