"use client";

import { initials } from "@/components/layout/user-account-badge";
import { useSession } from "@/lib/auth/use-session";

export function MobileNavAccountRow() {
  const { data: user } = useSession();

  if (!user) return null;

  return (
    <div className="flex h-12 items-center gap-2.5 rounded-md px-2.5 text-ui text-foreground-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-caption font-semibold text-primary">
        {initials(user.name, user.email)}
      </span>
      {user.name ?? user.email}
    </div>
  );
}
