import { Badge } from "@/components/ui/badge";
import { SYNC_STATE_LABELS } from "@/constants/labels";
import type { SyncState } from "@/lib/documents/sync-state";
import { cn } from "@/lib/utils";

// "saving" and "offline" share the warning look for now — no separate token
// distinguishes them yet, and Part 1 never reaches either state anyway.
const SYNC_VARIANT = {
  draft: "draft",
  saving: "warning",
  saved: "success",
  offline: "warning",
  error: "destructive",
} as const;

const SYNC_DOT = {
  draft: "bg-neutral",
  saving: "bg-warning",
  saved: "bg-success",
  offline: "bg-warning",
  error: "bg-destructive",
} as const;

export function SyncBadge({
  state,
  className,
}: {
  state: SyncState;
  className?: string;
}) {
  return (
    <Badge variant={SYNC_VARIANT[state]} size="md" className={className}>
      <span className={cn("size-1.5 rounded-full", SYNC_DOT[state])} />
      {SYNC_STATE_LABELS[state]}
    </Badge>
  );
}
