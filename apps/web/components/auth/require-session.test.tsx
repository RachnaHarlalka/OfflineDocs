import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedLayout from "@/app/(protected)/layout";
import { SESSION_LABELS } from "@/constants/labels";
import { useSession } from "@/lib/auth/use-session";

// require-session.tsx composes with the app shell, not around it — this
// suite renders the real ProtectedLayout (shell + guard) so a regression that
// moves the guard back outside the shell would fail here, not just a unit of
// RequireSession in isolation.

vi.mock("@/lib/auth/use-session", () => ({
  useSession: vi.fn(),
  // SignOutButton in AppSidenav also calls this — unrelated to the guard
  // under test, but the shell renders it regardless of session state.
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/doc/abc",
}));

const session = vi.mocked(useSession);

function renderProtectedLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProtectedLayout>
        <div>secret protected content</div>
      </ProtectedLayout>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
  session.mockReset();
  // currentPathWithQuery() reads window.location directly, not the mocked
  // usePathname — the guard's redirect target comes from the real URL.
  window.history.pushState({}, "", "/doc/abc?x=1");
  // MobileNavProvider (part of the real AppShell this suite renders) watches
  // a media query; jsdom has no matchMedia implementation.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

describe("RequireSession inside the protected layout [AC-223] [AC-224]", () => {
  it("paints the shell landmarks and confines the pending spinner to the content area, with no account details, no redirect and no children", () => {
    session.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useSession>);

    renderProtectedLayout();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText(SESSION_LABELS.checking)).toBeInTheDocument();

    expect(screen.queryByText("secret protected content")).not.toBeInTheDocument();
    expect(screen.queryByText(/@example\.test/)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to login preserving the original path and query once the session resolves to no user, without ever exposing children or account details", () => {
    session.mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSession>);

    renderProtectedLayout();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?returnTo=%2Fdoc%2Fabc%3Fx%3D1");

    expect(screen.queryByText("secret protected content")).not.toBeInTheDocument();
    expect(screen.queryByText(/@example\.test/)).not.toBeInTheDocument();
  });
});
