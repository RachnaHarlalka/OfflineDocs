"use client";

import { DocumentSearch } from "@/components/layout/document-search";
import { useMobileNav } from "@/components/layout/mobile-nav-context";

export function MobileSearchBar() {
  const { isOpen } = useMobileNav();

  return (
    <div
      className="shrink-0 border-b border-border bg-card px-4 py-2.5 md:hidden"
      inert={isOpen || undefined}
    >
      <DocumentSearch />
    </div>
  );
}
