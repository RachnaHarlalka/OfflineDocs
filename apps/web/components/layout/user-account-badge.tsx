"use client";

import { useSession } from "@/lib/auth/use-session";

export function initials(name: string | null, fallback: string) {
  const source = name?.trim() || fallback;
  return source.slice(0, 2).toUpperCase();
}

export function UserAccountBadge() {
  const { data: user } = useSession();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2.5 border-l border-border pl-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-caption font-semibold text-primary">
        {initials(user.name, user.email)}
      </span>
      <div className="hidden sm:block">
        <div className="text-ui leading-tight font-semibold">
          {user.name ?? user.email}
        </div>
        <div className="text-meta leading-tight text-muted-foreground">
          {user.email}
        </div>
      </div>
    </div>
  );
}
