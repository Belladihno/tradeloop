export function DealsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading deals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-80 animate-pulse rounded-md bg-card" />
      ))}
    </div>
  );
}
