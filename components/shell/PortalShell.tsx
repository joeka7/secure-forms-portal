"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutGrid, LoaderCircle, LogOut, Menu, Users, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LOGIN_PATH } from "@/lib/config";
import { ROLE_LABELS, type Role } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { BrandMark } from "@/components/shell/BrandMark";
import { useRefreshOnHistoryNavigation } from "@/components/shell/useRefreshOnHistoryNavigation";
import { TimeZoneProvider } from "@/components/ui/TimeZone";

type ShellUser = { name: string; email: string; role: Role };
type NavItem = { href: string; label: string; icon: LucideIcon };

function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      // A full navigation drops every cached page from the client router.
      window.location.replace(LOGIN_PATH);
    }
  }
  return { signingOut, signOut };
}

function NavList({ items, pathname, onNavigate, large }: { items: NavItem[]; pathname: string; onNavigate?: () => void; large?: boolean }) {
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 transition-colors",
                  large ? "min-h-[48px] text-base" : "py-2.5 text-[15px]",
                  active ? "bg-accent-soft font-semibold text-accent" : "font-medium text-ink-nav hover:bg-surface-hover hover:text-primary"
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden="true" />}
                <Icon className={large ? "h-5 w-5" : "h-[18px] w-[18px]"} aria-hidden="true" strokeWidth={1.9} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-white", size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-[13px]")}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function SignOutButton({ large }: { large?: boolean }) {
  const { signingOut, signOut } = useSignOut();
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={signingOut}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg font-medium transition-colors disabled:opacity-60",
        large
          ? "min-h-[48px] justify-center border border-line-strong bg-surface text-[15px] font-semibold text-primary hover:bg-surface-hover"
          : "px-3 py-2.5 text-sm text-ink-nav hover:bg-surface-hover hover:text-primary"
      )}
    >
      {signingOut ? (
        <LoaderCircle className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.9} />
      )}
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

/**
 * Authenticated layout: a fixed 264px sidebar on desktops; a sticky 64px top bar with a right-side
 * navigation drawer on phones and tablets. The Submissions and Users entries are a convenience only;
 * their pages and APIs enforce administrator access on the server.
 */
export function PortalShell({
  user,
  canManageUsers,
  canViewSubmissions,
  timeZone,
  children,
}: {
  user: ShellUser;
  canManageUsers: boolean;
  canViewSubmissions: boolean;
  timeZone: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  useRefreshOnHistoryNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const items: NavItem[] = [
    { href: "/forms", label: "Forms", icon: LayoutGrid },
    ...(canViewSubmissions ? [{ href: "/submissions", label: "Submissions", icon: Inbox }] : []),
    ...(canManageUsers ? [{ href: "/users", label: "Users", icon: Users }] : []),
  ];

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <TimeZoneProvider timeZone={timeZone}>
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <div className="min-h-screen w-full bg-canvas lg:pl-[264px]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-surface lg:flex" aria-label="Sidebar">
          <div className="px-6 pb-6 pt-7">
            <Link href="/forms" aria-label="Secure Forms Portal home" className="inline-block rounded-md">
              <BrandMark />
            </Link>
          </div>
          <div className="flex-1 px-3">
            <NavList items={items} pathname={pathname} />
          </div>
          <div className="border-t border-line-soft p-3">
            <div className="flex items-center gap-3 rounded-lg px-3 py-3">
              <Avatar name={user.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary">{user.name}</p>
                <p className="truncate text-xs text-muted">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </aside>

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 lg:hidden">
          <Link href="/forms" aria-label="Secure Forms Portal home" className="inline-flex items-center rounded-md">
            <BrandMark compact />
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="nav-drawer"
            className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-primary shadow-card transition-colors hover:bg-surface-hover"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 animate-fade-in bg-dark/40 motion-reduce:animate-none" aria-hidden="true" onClick={closeDrawer} />
            <div
              id="nav-drawer"
              ref={drawerRef}
              className="absolute inset-y-0 right-0 flex w-[320px] max-w-[88vw] animate-drawer-in flex-col overflow-y-auto bg-surface shadow-2xl motion-reduce:animate-none"
            >
              <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
                <p className="text-base font-semibold text-primary">Menu</p>
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close navigation"
                  className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-primary shadow-card hover:bg-surface-hover"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="px-4 pt-4 sm:px-6">
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-hover p-3">
                  <Avatar name={user.name} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-primary">{user.name}</p>
                    <p className="truncate text-[13px] text-muted">{user.email}</p>
                    <p className="mt-1 inline-flex rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-inset ring-accent/15">
                      {ROLE_LABELS[user.role]}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 px-2 pt-4 sm:px-4">
                <NavList items={items} pathname={pathname} onNavigate={() => setDrawerOpen(false)} large />
              </div>
              <div className="border-t border-line-soft p-4 sm:px-6">
                <SignOutButton large />
              </div>
            </div>
          </div>
        )}

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-content px-4 pb-16 pt-6 outline-none sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
    </TimeZoneProvider>
  );
}
