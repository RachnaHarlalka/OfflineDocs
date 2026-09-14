"use client";

import type { ReactNode } from "react";
import { useMobileNav } from "@/components/layout/mobile-nav-context";

export function AppMain({ children }: { children: ReactNode }) {
  const { isOpen } = useMobileNav();

  return (
    <main className="min-w-0 flex-1 overflow-y-auto" inert={isOpen || undefined}>
      {children}
    </main>
  );
}
