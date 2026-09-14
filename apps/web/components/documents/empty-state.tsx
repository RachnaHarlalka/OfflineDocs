import { FilePlus } from "lucide-react";
import type { ReactNode } from "react";
import { DOCUMENTS_PAGE_LABELS } from "@/constants/labels";
import { cn } from "@/lib/utils";

export function EmptyState({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-16 text-center", className)}>
      <div className="mb-1 grid size-15 place-items-center rounded-[14px] border border-primary/25 bg-primary-soft text-primary">
        <FilePlus className="size-6.5" />
      </div>
      <p className="text-page-title">{DOCUMENTS_PAGE_LABELS.emptyTitle}</p>
      <p className="max-w-sm text-caption text-muted-foreground">
        {DOCUMENTS_PAGE_LABELS.emptyBody}
      </p>
      {children}
    </div>
  );
}
