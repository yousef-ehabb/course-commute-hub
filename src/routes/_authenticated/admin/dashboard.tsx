import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  pendingComponent: () => (
    <div className="space-y-6 pt-4">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  ),
});
