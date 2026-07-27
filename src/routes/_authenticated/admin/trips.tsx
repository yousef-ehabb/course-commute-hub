import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/trips")({
  pendingComponent: () => (
    <div className="space-y-6 pt-4 pb-24">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>

      {/* Header card skeleton */}
      <Skeleton className="h-24 w-full rounded-xl" />

      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  ),
});
