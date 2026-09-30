import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardHeading } from "@/components/documents/dashboard-heading";
import { DocumentTable } from "@/components/documents/document-table";

export const metadata: Metadata = { title: "Dashboard · DocSync" };

export default function DashboardPage() {
  return (
    <div className="px-4 py-5 sm:px-8 sm:py-7">
      {/* Both read `?view=` via useSearchParams, which Next requires under a Suspense boundary. */}
      <Suspense>
        <DashboardHeading />
        <DocumentTable />
      </Suspense>
    </div>
  );
}
