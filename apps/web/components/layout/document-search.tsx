import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { APP_SHELL_LABELS } from "@/constants/labels";
import { cn } from "@/lib/utils";

export function DocumentSearch({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={APP_SHELL_LABELS.searchPlaceholder}
        className="h-9.5 bg-card pl-9 text-ui"
      />
    </div>
  );
}
