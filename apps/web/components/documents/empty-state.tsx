import { FilePlus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DOCUMENTS_PAGE_LABELS } from "@/constants/labels";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = FilePlus,
  title = DOCUMENTS_PAGE_LABELS.emptyTitle,
  body = DOCUMENTS_PAGE_LABELS.emptyBody,
  children,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  body?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-16 text-center", className)}>
      <div className="mb-1 grid size-15 place-items-center rounded-[14px] border border-primary/25 bg-primary-soft text-primary">
        <Icon className="size-6.5" />
      </div>
      <p className="text-page-title">{title}</p>
      <p className="max-w-sm text-caption text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
