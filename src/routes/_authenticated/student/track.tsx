import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/student/track")({
  pendingComponent: () => (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </div>
      <Skeleton className="h-[300px] w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  ),
});
