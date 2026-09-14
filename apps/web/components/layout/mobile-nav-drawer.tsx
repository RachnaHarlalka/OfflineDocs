"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "@/components/layout/mobile-nav-context";

export function MobileNavDrawer({ children }: { children: ReactNode }) {
  const { isOpen, close } = useMobileNav();

  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
        className={cn(
          "absolute inset-0 z-40 bg-foreground/40 md:hidden",
          isOpen ? "block" : "hidden",
        )}
      />
      <div
        className={cn(
          "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:-translate-x-full max-md:transition-transform max-md:duration-200",
          isOpen && "max-md:translate-x-0",
        )}
      >
        {children}
      </div>
    </>
  );
}
