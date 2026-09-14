import type { ReactNode } from "react";
import { AppTopbar } from "./app-topbar";
import { AppSidenav } from "./app-sidenav";
import { AppMain } from "./app-main";
import { MobileNavProvider } from "./mobile-nav-context";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { MobileNewDocumentBar } from "./mobile-new-document-bar";
import { MobileSearchBar } from "./mobile-search-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="flex min-h-svh flex-col">
        <AppTopbar />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <MobileSearchBar />
          <div className="flex min-h-0 flex-1">
            <MobileNavDrawer>
              <AppSidenav />
            </MobileNavDrawer>
            <AppMain>{children}</AppMain>
          </div>
          <MobileNewDocumentBar />
        </div>
      </div>
    </MobileNavProvider>
  );
}
