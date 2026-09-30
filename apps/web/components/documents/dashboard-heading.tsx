"use client";

import { DOCUMENTS_PAGE_LABELS } from "@/constants/labels";
import { useDashboardView } from "@/lib/documents/use-dashboard-view";

export function DashboardHeading() {
  const view = useDashboardView();

  return (
    <h1 className="mb-5.5 text-page-title">
      {view === "shared" ? DOCUMENTS_PAGE_LABELS.sharedTitle : DOCUMENTS_PAGE_LABELS.title}
    </h1>
  );
}
