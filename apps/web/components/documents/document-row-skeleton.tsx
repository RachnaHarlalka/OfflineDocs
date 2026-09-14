export function DocumentRowSkeleton() {
  return (
    <li className="flex h-15 items-center gap-3 px-5">
      <div className="h-4 w-1/3 max-w-64 animate-pulse rounded-md bg-muted" />
      <div className="ml-auto hidden h-4 w-16 animate-pulse rounded-md bg-muted md:block" />
      <div className="hidden h-4 w-20 animate-pulse rounded-md bg-muted md:block" />
    </li>
  );
}
