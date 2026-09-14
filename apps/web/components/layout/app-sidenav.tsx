import Link from "next/link";
import { Clock, FileText, Settings, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_SHELL_LABELS } from "@/constants/labels";
import { ROUTES } from "@/constants/routes";
import { MobileNavAccountRow } from "@/components/layout/mobile-nav-account-row";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";


const PRIMARY_NAV = [
  {
    label: APP_SHELL_LABELS.allDocuments,
    icon: FileText,
    count: null,
    active: true,
    href: ROUTES.dashboard,
  },
  { label: APP_SHELL_LABELS.sharedWithMe, icon: Users, count: null, active: false, href: null },
  { label: APP_SHELL_LABELS.recent, icon: Clock, count: null, active: false, href: null },
] as const;

const ACCOUNT_NAV = [
  { label: APP_SHELL_LABELS.profile, icon: User },
  { label: APP_SHELL_LABELS.settings, icon: Settings },
] as const;

export function AppSidenav() {
  return (
    <nav className="flex h-full w-full shrink-0 flex-col border-r border-border bg-card p-3 md:w-16 md:px-1.5 lg:w-59 lg:px-3">
      <div className="flex flex-1 flex-col gap-1 md:hidden">
        {PRIMARY_NAV.map(({ label, icon: Icon, count, active, href }) => {
          const className = cn(
            "flex h-12 items-center gap-2.5 rounded-md px-2.5 text-ui text-foreground-2",
            active && "bg-primary-soft text-primary",
          );
          const content = (
            <>
              <Icon className="size-4 shrink-0" />
              {label}
              {count !== null ? (
                <span className="ml-auto font-mono text-meta text-muted-foreground">
                  {count}
                </span>
              ) : null}
            </>
          );
          return href ? (
            <Link key={label} href={href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={label} className={className}>
              {content}
            </div>
          );
        })}

        <div className="my-2 h-px bg-border" />

        <MobileNavAccountRow />

        <div className="flex h-12 items-center gap-2.5 rounded-md px-2.5 text-ui text-foreground-2">
          <Settings className="size-4 shrink-0" />
          {APP_SHELL_LABELS.settings}
        </div>

        <div className="flex-1" />

        <div className="flex h-12 items-center gap-2.5 rounded-md px-2.5 text-ui text-foreground-2">
          <span className="flex-1">{APP_SHELL_LABELS.theme}</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Tablet icon rail / desktop full nav. */}
      <div className="hidden flex-1 flex-col gap-0.5 md:flex">
        {PRIMARY_NAV.map(({ label, icon: Icon, count, active, href }) => {
          const className = cn(
            "flex h-9 items-center justify-center gap-2.5 rounded-md px-0 text-ui text-foreground-2 lg:justify-start lg:px-2.5",
            active && "bg-primary-soft text-primary",
          );
          const content = (
            <>
              <Icon className="size-4 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
              {count !== null ? (
                <span className="ml-auto hidden font-mono text-meta text-muted-foreground lg:inline">
                  {count}
                </span>
              ) : null}
            </>
          );
          return href ? (
            <Link key={label} href={href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={label} className={className}>
              {content}
            </div>
          );
        })}

        <div className="my-3 hidden h-px bg-border lg:block" />

        <div className="hidden px-2.5 py-1.5 text-label text-muted-foreground uppercase lg:block">
          {APP_SHELL_LABELS.account}
        </div>
        {ACCOUNT_NAV.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="hidden h-9 items-center gap-2.5 rounded-md px-2.5 text-ui text-foreground-2 lg:flex"
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </div>
        ))}

        <div className="hidden lg:block">
          <SignOutButton />
        </div>

        <div className="flex-1" />

        <div className="hidden rounded-lg bg-secondary p-3 lg:block">
          <div className="text-ui font-semibold">{APP_SHELL_LABELS.offlineTitle}</div>
          <p className="mt-1 text-caption text-muted-foreground">
            {APP_SHELL_LABELS.offlineBody}
          </p>
        </div>
      </div>
    </nav>
  );
}
