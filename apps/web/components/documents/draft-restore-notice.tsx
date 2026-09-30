"use client";

import { Button } from "@/components/ui/button";
import { DRAFT_RESTORE_LABELS } from "@/constants/labels";
import { relativeTime } from "@/lib/documents/relative-time";

/**
 * Offers back the caller's own server-side draft backup (techspec 4.1, AC-116).
 *
 * Offered, never applied: the backup is writing this device does not have, and
 * merging someone's older draft into what is on screen without asking is the same
 * surprise the explicit-save model exists to avoid — see `DocSavedNotice`, which
 * offers a reload rather than performing one.
 *
 * Dismissing only ends the offer. The backup stays on the server until this
 * device's next heartbeat replaces it, so "Not now" costs the user nothing.
 */
export function DraftRestoreNotice({
  backedUpAt,
  onRestore,
  onDismiss,
}: {
  /** ISO timestamp of the backup, so the offer says *which* draft it means. */
  backedUpAt: string;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  const { title, bodyPrefix, restore, dismiss } = DRAFT_RESTORE_LABELS;

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-brand/25 bg-brand-soft px-4 py-2 text-caption text-brand sm:px-8"
    >
      <span className="font-medium">{title}</span>
      <span className="min-w-0 flex-1">
        {bodyPrefix} {relativeTime(backedUpAt)}.
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onRestore}>
          {restore}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {dismiss}
        </Button>
      </div>
    </div>
  );
}
