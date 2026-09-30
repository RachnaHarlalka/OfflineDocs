import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Shared waiting state for the auth guards, the home redirect and the OAuth callback.
 *
 * Fills the viewport by default, which is right for the two routes that *are* the
 * whole page. Inside an app shell the chrome is already on screen and only the
 * content area is waiting, so those callers pass a height of their own.
 */
export function SessionPending({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-svh items-center justify-center p-6", className)}>
      <p aria-live="polite" className="flex items-center gap-2 text-ui text-muted-foreground">
        <Spinner />
        {label}
      </p>
    </div>
  );
}
