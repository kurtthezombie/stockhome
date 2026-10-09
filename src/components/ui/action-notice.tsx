"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActionNotice({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md sm:left-auto sm:mx-0">
      <div className={cn(message && "motion-enter pointer-events-auto flex items-start gap-3 rounded-xl border border-primary/25 bg-card p-4 shadow-lg")}>
        <div role="status" aria-live="polite" aria-atomic="true" className="min-w-0 flex-1">
          {message && <p className="flex items-start gap-2 break-words text-sm text-foreground"><span aria-hidden="true" className="font-semibold text-primary">✓</span><span className="min-w-0">{message}</span></p>}
        </div>
        {message && <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2 shrink-0" aria-label="Dismiss notification" onClick={onDismiss}>×</Button>}
      </div>
    </div>
  );
}
