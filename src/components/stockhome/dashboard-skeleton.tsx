import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardDetailsSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-6">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-3/4" />
            <div className="mt-3 flex gap-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-28" /></div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {["w-4/5", "w-3/5", "w-2/3", "w-2/5"].map((width) => (
              <div key={width} className="grid gap-1.5">
                <div className="flex justify-between"><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-12" /></div>
                <div className="rounded-md bg-muted/40"><Skeleton className={`h-5 ${width}`} /></div>
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
            <Skeleton className="mt-1 h-4 w-40" />
            <div className="flex gap-4"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-20" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-4/5" /></CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2"><Skeleton className="h-10 w-20" /><Skeleton className="h-4 w-40" /></div>
            <Skeleton className="h-3 w-full" />
            <div className="grid gap-3">{[0, 1, 2].map((row) => <div key={row} className="flex justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-6" /></div>)}</div>
            <Skeleton className="h-5 w-28" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <Card key={card}>
            <CardHeader><Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-4/5" /></CardHeader>
            <CardContent className="grid gap-4">
              {[0, 1, 2].map((row) => <div key={row} className="flex justify-between gap-3 border-b border-border/70 pb-3"><Skeleton className="h-5 w-3/5" /><Skeleton className="h-5 w-14" /></div>)}
              <Skeleton className="h-5 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
