"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { isSidebarItemActive, type AppSidebarItem } from "@/components/layout/sidebar-types";
import type { BootstrapNavigationItem } from "@/features/bootstrap/api";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";
import { getSessionSnapshot, subscribeToSession } from "@/features/auth/session";

type AppShellProps = {
  children: ReactNode;
};

function toSidebarItems(bootstrapNavigation: BootstrapNavigationItem[] = []): AppSidebarItem[] {
  return bootstrapNavigation.map((item) => ({
    key: item.key,
    label: item.label,
    href: item.href,
    icon: item.key,
    section: item.section,
  }));
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isPublicAuthRoute = pathname === "/login" || pathname === "/signup";
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const {
    data: bootstrap,
    loading: bootstrapLoading,
    error: bootstrapError,
    refresh: refreshBootstrap,
  } = useBootstrap(true);

  const resolvedSidebarItems = useMemo<AppSidebarItem[]>(
    () => toSidebarItems(bootstrap?.navigation || []),
    [bootstrap],
  );

  const hasNavigation = resolvedSidebarItems.length > 0;
  const defaultRoute = bootstrap?.workspace?.default_route
    || resolvedSidebarItems[0]?.href
    || null;
  const matchingRoute = useMemo(
    () => resolvedSidebarItems.find((item) => isSidebarItemActive(pathname, item)) || null,
    [pathname, resolvedSidebarItems],
  );

  useEffect(() => {
    if (isPublicAuthRoute) {
      if (session) {
        router.replace("/");
      }
      return;
    }

    if (!session) {
      router.replace("/login");
      return;
    }

    if (bootstrapLoading || !bootstrap || bootstrapError) {
      return;
    }

    if (pathname === "/" && defaultRoute) {
      router.replace(defaultRoute);
      return;
    }

    if (hasNavigation && !matchingRoute && defaultRoute && pathname !== defaultRoute) {
      router.replace(defaultRoute);
    }
  }, [
    bootstrap,
    bootstrapError,
    bootstrapLoading,
    defaultRoute,
    hasNavigation,
    isPublicAuthRoute,
    matchingRoute,
    pathname,
    router,
    session,
  ]);

  if (isPublicAuthRoute) {
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

  if (bootstrapError) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[980px] rounded-[var(--radius-xl)] border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
            Bootstrap Error
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--ui-text)]">
            Workspace non disponibile
          </h2>
          <p className="mt-3 text-sm text-[var(--ui-muted)]">{bootstrapError}</p>
          <button
            type="button"
            className="halo-btn-primary mt-4 px-4 py-2"
            onClick={refreshBootstrap}
          >
            Riprova bootstrap
          </button>
        </div>
      </div>
    );
  }

  if (bootstrapLoading || !bootstrap) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[980px] rounded-[var(--radius-xl)] border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-[var(--shadow-soft)]">
          <div className="halo-skeleton h-16 w-full" />
          <div className="halo-skeleton mt-3 h-10 w-2/3" />
          <div className="halo-skeleton mt-3 h-40 w-full" />
        </div>
      </div>
    );
  }

  const brandProductName = bootstrap.tenant?.branding?.product_name || "HALO";
  const workspaceLabel =
    bootstrap.workspace?.workspace_label || `${brandProductName} Workspace`;
  const searchPlaceholder =
    bootstrap.workspace?.search_placeholder
    || `Ricerca rapida moduli e ${bootstrap.labels?.client_plural || "clienti"}...`;
  const timezone = bootstrap.tenant?.timezone || "Europe/Rome";

  return (
    <div className="min-h-screen bg-[var(--ui-bg)]">
      <AppSidebar
        pathname={pathname}
        items={resolvedSidebarItems}
        homeHref={defaultRoute || "/"}
        brandProductName={brandProductName}
        userLabel={bootstrap.current_user?.role_alias || `Utente #${session.userId}`}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <main
        className={`min-h-screen transition-[margin-left] duration-300 ${
          sidebarCollapsed ? "lg:ml-[5.25rem]" : "lg:ml-[16.75rem]"
        }`}
      >
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
                  <path
                    d="M3.8 6.2h12.4M3.8 10h12.4M3.8 13.8h12.4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
                  {workspaceLabel}
                </p>
                <h1 className="truncate text-base font-semibold text-[var(--ui-text)] sm:text-lg">
                  {matchingRoute?.label || bootstrap.tenant?.display_name || "Workspace"}
                </h1>
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 md:flex">
              <label className="flex w-full max-w-[360px] items-center gap-2 rounded-[0.75rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-3 py-2 text-sm text-[var(--ui-muted)]">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <circle cx="8.6" cy="8.6" r="4.6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12.3 12.2L16 15.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="truncate text-xs text-[var(--ui-muted)]">{searchPlaceholder}</span>
              </label>
              <div className="inline-flex items-center rounded-[0.7rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-3 py-1.5 text-xs font-medium text-[var(--ui-muted)]">
                {new Intl.DateTimeFormat("it-IT", {
                  dateStyle: "full",
                  timeZone: timezone,
                }).format(new Date())}
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[1800px] p-3 sm:p-4 lg:p-6">
          {!hasNavigation ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--ui-border)] bg-white/80 p-6 shadow-sm">
              <p className="text-sm text-[var(--ui-muted)]">
                Nessuna sezione disponibile per questo utente nel tenant corrente.
              </p>
            </div>
          ) : (
            children
          )}
        </section>
      </main>
    </div>
  );
}
