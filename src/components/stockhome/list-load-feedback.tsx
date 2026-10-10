import { Button } from "@/components/ui/button";
import { LoadingStatus } from "@/components/ui/loading-status";

export function ListLoadFeedback({ loading, hasLoaded, error, label, onRetry, retryDisabled = false, retryFocusTarget }: {
  loading: boolean;
  hasLoaded: boolean;
  error: string | null;
  label: string;
  onRetry: () => void;
  retryDisabled?: boolean;
  retryFocusTarget?: string;
}) {
  return (
    <>
      {loading && hasLoaded ? <LoadingStatus className="justify-start text-sm text-primary">Refreshing your {label}…</LoadingStatus> : null}
      {error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-destructive/5 p-4">
          <div role="alert" className="min-w-0 flex-1 text-sm text-destructive">
            <p>{error}</p>
            {hasLoaded ? <p>Your previous list is still shown. It may be out of date.</p> : null}
          </div>
          <Button variant="outline" disabled={loading || retryDisabled} onClick={() => {
            // Retry disappears when the error clears; preserve a useful focus target.
            if (retryFocusTarget) document.querySelector<HTMLElement>(retryFocusTarget)?.focus({ preventScroll: true });
            onRetry();
          }}>Retry</Button>
        </div>
      ) : null}
    </>
  );
}
