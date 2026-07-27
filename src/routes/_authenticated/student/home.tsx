import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/student/home")({
  pendingComponent: () => (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </div>
      <Skeleton className="h-[200px] w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  ),
});
