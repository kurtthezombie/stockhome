import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ListSkeleton({ variant, className }: {
  variant: "inventory" | "tasks" | "groceries";
  className?: string;
}) {
  return (
    <div aria-hidden="true" data-slot="list-skeleton" className={cn("grid gap-3", className)}>
      {Array.from({ length: variant === "inventory" ? 4 : 3 }, (_, index) => (
        variant === "groceries" ? (
          <div key={index} className="flex items-center gap-3 rounded-xl border p-4">
            <Skeleton className="size-4 shrink-0" />
            <div className="grid flex-1 gap-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/3" /></div>
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <Card key={index} size={variant === "tasks" ? "sm" : "default"}>
            <CardContent className="grid gap-4">
              <div className="flex gap-3">
                {variant === "tasks" ? <Skeleton className="mt-1 size-4 shrink-0" /> : null}
                <div className="grid flex-1 gap-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-5 w-24" /></div>
              </div>
              {variant === "inventory" ? (
                <div className="grid grid-cols-2 gap-3 border-t pt-4">
                  {[0, 1].map((column) => <div key={column} className="grid gap-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-6 w-3/4" /></div>)}
                  <Skeleton className="col-span-2 h-9 w-1/2" />
                </div>
              ) : null}
              <div className="flex justify-end gap-2 border-t pt-3"><Skeleton className="size-10" /><Skeleton className="size-10" /></div>
            </CardContent>
          </Card>
        )
      ))}
    </div>
  );
}

export function GroceryPageSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-6">
      {[0, 1].map((section) => (
        <Card key={section}>
          <CardContent className="grid gap-5">
            <div className="grid gap-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-5 w-3/4" /></div>
            {section === 0 ? <div className="flex gap-2"><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-20" /></div> : null}
            <ListSkeleton variant="groceries" className={section === 1 ? "sm:grid-cols-2" : undefined} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
