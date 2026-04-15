"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  filterSidebarItemsByRole,
  isSidebarItemActive,
  type AppSidebarItem,
} from "@/components/layout/sidebar-types";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";
import {
  getSessionSnapshot,
  subscribeToSession,
  type UserRole,
} from "@/features/auth/session";

type AppShellProps = {
  children: ReactNode;
};

const sidebarItems: AppSidebarItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: "meter",
    roles: ["ADMIN", "DENTISTA", "DIPENDENTE", "SEGRETARIO"],
  },
  {
    key: "agenda",
    label: "Agenda",
    href: "/agenda",
    icon: "calendar",
    roles: ["ADMIN", "DENTISTA", "DIPENDENTE", "SEGRETARIO"],
  },
  {
    key: "clients",
    label: "Pazienti",
    href: "/pazienti",
    icon: "users",
    roles: ["ADMIN", "DENTISTA", "DIPENDENTE", "SEGRETARIO"],
  },
  {
    key: "billing",
    label: "Fatture",
    href: "/fatture",
    icon: "coin-euro",
    roles: ["ADMIN", "SEGRETARIO"],
  },
  { key: "inventory", label: "Magazzino", href: "/magazzino", icon: "drawer", roles: ["ADMIN"] },
  {
    key: "settings",
    label: "Impostazioni",
    href: "/impostazioni",
    icon: "equalizer",
    roles: ["ADMIN"],
  },
];

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isLoginRoute = pathname === "/login";
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const { data: bootstrap } = useBootstrap(true);

  const resolvedSidebarItems = useMemo<AppSidebarItem[]>(() => {
    if (bootstrap?.navigation?.length) {
      return bootstrap.navigation.map((item) => ({
        key: item.key,
        label: item.label,
        href: item.href,
        icon: item.key,
      }));
    }

    return sidebarItems;
  }, [bootstrap]);

  const defaultRouteByRole = useMemo(
    () => (role: UserRole) => {
      const firstAllowedRoute =
        bootstrap?.navigation?.length
          ? resolvedSidebarItems[0]
          : resolvedSidebarItems.find((item) => item.roles?.includes(role));
      return firstAllowedRoute?.href || "/dashboard";
    },
    [bootstrap, resolvedSidebarItems],
  );

  const matchingRoute = useMemo(
    () =>
      resolvedSidebarItems.find((item) => isSidebarItemActive(pathname, item)),
    [pathname, resolvedSidebarItems],
  );

  useEffect(() => {
    if (isLoginRoute) {
      if (session) {
        const nextPath = defaultRouteByRole(session.ruolo);
        if (nextPath !== pathname) {
          router.replace(nextPath);
        }
      }
      return;
    }

    if (!session) {
      router.replace("/login");
      return;
    }

    if (pathname === "/") {
      const nextPath = defaultRouteByRole(session.ruolo);
      if (nextPath !== pathname) {
        router.replace(nextPath);
      }
      return;
    }

    if (bootstrap && !matchingRoute) {
      const fallbackPath = defaultRouteByRole(session.ruolo);
      if (fallbackPath !== pathname) {
        router.replace(fallbackPath);
      }
      return;
    }

    if (!bootstrap && matchingRoute?.roles && !matchingRoute.roles.includes(session.ruolo)) {
      const fallbackPath = defaultRouteByRole(session.ruolo);
      if (fallbackPath !== pathname) {
        router.replace(fallbackPath);
      }
    }
  }, [bootstrap, defaultRouteByRole, isLoginRoute, matchingRoute, pathname, router, session]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (!session) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[980px] rounded-[var(--radius-xl)] border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-[var(--shadow-soft)]">
          <div className="halo-skeleton h-16 w-full" />
        </div>
      </div>
    );
  }

  const visibleSidebarItems =
    bootstrap?.navigation?.length
      ? resolvedSidebarItems
      : filterSidebarItemsByRole(resolvedSidebarItems, session.ruolo);

  return (
    <div className="min-h-screen bg-[var(--ui-bg)]">
      <AppSidebar
        pathname={pathname}
        items={visibleSidebarItems}
        brandProductName={bootstrap?.tenant?.branding?.product_name || "HALO"}
        userLabel={bootstrap?.current_user?.role_alias || `Utente #${session.userId}`}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <main className={`min-h-screen transition-[margin-left] duration-300 ${sidebarCollapsed ? "lg:ml-[5.25rem]" : "lg:ml-[16.75rem]"}`}>
        <header className="sticky top-0 z-20 border-b border-[var(--ui-border)] bg-[var(--ui-panel)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1800px] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[0.7rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] text-[var(--ui-text)] lg:hidden"
                aria-label="Apri menu"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M3.8 6.2h12.4M3.8 10h12.4M3.8 13.8h12.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
                  HALO Workspace
                </p>
                <h1 className="truncate text-base font-semibold text-[var(--ui-text)] sm:text-lg">
                  {matchingRoute?.label || "Dashboard"}
                </h1>
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 md:flex">
              <label className="flex w-full max-w-[360px] items-center gap-2 rounded-[0.75rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-3 py-2 text-sm text-[var(--ui-muted)]">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <circle cx="8.6" cy="8.6" r="4.6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12.3 12.2L16 15.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="truncate text-xs text-[var(--ui-muted)]">Ricerca rapida moduli e pazienti...</span>
              </label>
              <div className="inline-flex items-center rounded-[0.7rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-3 py-1.5 text-xs font-medium text-[var(--ui-muted)]">
                {new Intl.DateTimeFormat("it-IT", {
                  dateStyle: "full",
                  timeZone: "Europe/Rome",
                }).format(new Date())}
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[1800px] p-3 sm:p-4 lg:p-6">{children}</section>
      </main>
    </div>
  );
}
