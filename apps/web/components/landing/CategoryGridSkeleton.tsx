export function CategoryGridSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading categories" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-md bg-card" />
      ))}
    </div>
  );
}
