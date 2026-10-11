export default function PublicLoading() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="mx-auto max-w-[1280px] px-4 py-8 md:px-8">
      <div className="h-10 w-2/3 animate-pulse rounded-md bg-card" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-md bg-card" />
        ))}
      </div>
    </div>
  );
}
