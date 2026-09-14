"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_SHELL_LABELS } from "@/constants/labels";
import { useMobileNav } from "@/components/layout/mobile-nav-context";

export function MobileNavToggle() {
  const { isOpen, toggle } = useMobileNav();

  return (
    <Button
      variant="outline"
      size="icon"
      className="md:hidden"
      onClick={toggle}
      aria-label={isOpen ? APP_SHELL_LABELS.closeNavigation : APP_SHELL_LABELS.openNavigation}
    >
      {isOpen ? <X /> : <Menu />}
    </Button>
  );
}
