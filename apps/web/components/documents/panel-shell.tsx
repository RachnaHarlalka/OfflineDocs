import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


export const PANEL_CLASSNAME = [
  "fixed inset-x-0 top-auto bottom-0 z-50 flex h-auto max-h-[85dvh] w-full",
  "max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden",
  "rounded-t-2xl rounded-b-none border border-b-0 border-border p-0",
  "sm:max-w-none",
  "data-open:zoom-in-100 data-closed:zoom-out-100",
  "max-md:data-open:slide-in-from-bottom max-md:data-closed:slide-out-to-bottom",
  "md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:max-w-105",
  "md:rounded-none md:border-y-0 md:border-r-0 md:border-l",
  "md:data-open:slide-in-from-right md:data-closed:slide-out-to-right",
].join(" ");

export function PanelShell({
  onOpenChange,
  title,
  subtitle,
  footer,
  children,
}: {
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={PANEL_CLASSNAME}>
        <div
          aria-hidden="true"
          className="flex shrink-0 justify-center pt-2 pb-1 md:hidden"
        >
          <span className="h-1 w-9 rounded-full bg-border" />
        </div>

        <DialogHeader className="shrink-0 border-b border-border px-5 pt-2 pb-4 md:pt-5">
          <DialogTitle className="truncate pr-8 text-ui font-semibold">
            {title}
          </DialogTitle>
          {subtitle ? (
            <p className="truncate text-caption text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-border bg-muted/50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
