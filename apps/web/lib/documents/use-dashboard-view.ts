"use client";

import { useSearchParams } from "next/navigation";
import type { DocSummary } from "@docsync/shared";
import { DASHBOARD_VIEW } from "@/constants/routes";

export type DashboardView = "all" | "shared";

/** By role, not `ownerId` — ownership follows the role, and a doc can have several owners. */
export function isSharedWithMe(doc: Pick<DocSummary, "role">): boolean {
  return doc.role !== "owner";
}

export function useDashboardView(): DashboardView {
  const params = useSearchParams();
  return params.get(DASHBOARD_VIEW.param) === DASHBOARD_VIEW.shared ? "shared" : "all";
}
