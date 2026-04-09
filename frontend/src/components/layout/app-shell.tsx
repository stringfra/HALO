"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
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
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col lg:flex-row">
        <AppSidebar
          pathname={pathname}
          items={visibleSidebarItems}
          brandProductName={bootstrap?.tenant?.branding?.product_name || "HALO"}
          userLabel={bootstrap?.current_user?.role_alias || `Utente #${session.userId}`}
        />

        <main className="min-h-0 flex-1 overflow-auto border-t border-[var(--ui-border)] bg-[var(--ui-panel-solid)] lg:border-t-0 lg:border-l">
          <div className="p-3 sm:p-4 lg:p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
