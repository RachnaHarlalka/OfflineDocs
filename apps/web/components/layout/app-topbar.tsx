import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLockup } from "@/components/brand-lockup";
import { NewDocumentButton } from "@/components/documents/new-document-button";
import { DocumentSearch } from "@/components/layout/document-search";
import { MobileNavToggle } from "@/components/layout/mobile-nav-toggle";
import { UserAccountBadge } from "@/components/layout/user-account-badge";

export function AppTopbar() {
  return (
    <header className="flex h-15 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:gap-4 md:px-5.5">
      <MobileNavToggle />

      <BrandLockup />

      <DocumentSearch className="hidden w-full max-w-85 md:block" />

      <div className="flex-1" />

      <NewDocumentButton className="hidden md:inline-flex" />

      <div className="hidden md:block">
        <ThemeToggle />
      </div>

      <UserAccountBadge />
    </header>
  );
}
