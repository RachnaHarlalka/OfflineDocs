import { RequireSession } from "@/components/auth/require-session";
import { AppShell } from "@/components/layout/app-shell";

export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireSession>
      <AppShell>{children}</AppShell>
    </RequireSession>
  );
}
