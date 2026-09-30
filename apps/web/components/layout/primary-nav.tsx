"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_SHELL_LABELS } from "@/constants/labels";
import { ROUTES } from "@/constants/routes";
import { useMobileNav } from "@/components/layout/mobile-nav-context";
import { isSharedWithMe, useDashboardView } from "@/lib/documents/use-dashboard-view";
import { useDocs } from "@/lib/documents/use-documents";

const PRIMARY_NAV = [
  { key: "all", label: APP_SHELL_LABELS.allDocuments, icon: FileText, href: ROUTES.dashboard },
  { key: "shared", label: APP_SHELL_LABELS.sharedWithMe, icon: Users, href: ROUTES.sharedWithMe },
  { key: "recent", label: APP_SHELL_LABELS.recent, icon: Clock, href: null },
] as const;

type NavKey = (typeof PRIMARY_NAV)[number]["key"];

const VARIANT_CLASSES = {
  mobile: {
    item: "flex h-12 items-center gap-2.5 rounded-md px-2.5 text-ui text-foreground-2",
    label: "",
    count: "ml-auto font-mono text-meta text-muted-foreground",
  },
  desktop: {
    item: "flex h-9 items-center justify-center gap-2.5 rounded-md px-0 text-ui text-foreground-2 lg:justify-start lg:px-2.5",
    label: "hidden lg:inline",
    count: "ml-auto hidden font-mono text-meta text-muted-foreground lg:inline",
  },
} as const;

export function PrimaryNav({ variant }: { variant: keyof typeof VARIANT_CLASSES }) {
  const pathname = usePathname();
  const view = useDashboardView();
  const { data: docs } = useDocs();
  // The drawer stays mounted across in-app navigation, so a link has to close it.
  const { close } = useMobileNav();
  const { item, label: labelClass, count: countClass } = VARIANT_CLASSES[variant];

  const activeKey: NavKey | null = pathname === ROUTES.dashboard ? view : null;
  // No badge until the list has loaded, and none on an empty "Shared with me" (design 1b).
  const counts: Record<NavKey, number | null> = {
    all: docs?.length ?? null,
    shared: docs?.filter(isSharedWithMe).length || null,
    recent: null,
  };

  return PRIMARY_NAV.map(({ key, label, icon: Icon, href }) => {
    const active = key === activeKey;
    const count = counts[key];
    const className = cn(item, active && "bg-primary-soft text-primary");
    const content = (
      <>
        <Icon className="size-4 shrink-0" />
        <span className={labelClass}>{label}</span>
        {count !== null ? <span className={countClass}>{count}</span> : null}
      </>
    );

    return href ? (
      <Link
        key={key}
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={close}
        className={className}
      >
        {content}
      </Link>
    ) : (
      <div key={key} className={className}>
        {content}
      </div>
    );
  });
}
