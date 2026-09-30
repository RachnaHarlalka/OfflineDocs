import { RequireSession } from "@/components/auth/require-session";
import { AppShell } from "@/components/layout/app-shell";

// The shell wraps the guard, not the other way round: the chrome is static and
// needs no session to render, so a refresh paints the sidenav and top bar at once
// and waits only where the answer actually matters — the content area.
export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      <RequireSession>{children}</RequireSession>
    </AppShell>
  );
}
