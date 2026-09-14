"use client";

import { NewDocumentButton } from "@/components/documents/new-document-button";
import { useMobileNav } from "@/components/layout/mobile-nav-context";

export function MobileNewDocumentBar() {
  const { isOpen } = useMobileNav();

  return (
    <div
      className="shrink-0 border-t border-border bg-card px-3.5 py-3 md:hidden"
      inert={isOpen || undefined}
    >
      <NewDocumentButton className="h-12 w-full" />
    </div>
  );
}
