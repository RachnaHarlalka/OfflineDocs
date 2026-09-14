"use client";

import { LogOut } from "lucide-react";
import { SESSION_LABELS } from "@/constants/labels";
import { useLogout } from "@/lib/auth/use-session";

export function SignOutButton() {
  const { mutate: signOut, isPending: signingOut } = useLogout();

  return (
    <button
      type="button"
      onClick={() => signOut()}
      disabled={signingOut}
      className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-left text-ui text-foreground-2 hover:bg-accent disabled:opacity-50"
    >
      <LogOut className="size-4 shrink-0" />
      {signingOut ? SESSION_LABELS.signingOut : SESSION_LABELS.signOut}
    </button>
  );
}
