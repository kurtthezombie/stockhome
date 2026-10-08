import { cn } from "@/lib/utils";

export function LoadingStatus({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span role="status" className={cn("inline-flex items-center justify-center gap-2", className)}>
      <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
      <span>{children}</span>
    </span>
  );
}
