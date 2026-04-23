"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SidebarFooter } from "@/components/layout/sidebar-footer";
import { SidebarMenuList } from "@/components/layout/sidebar-menu-list";
import type { AppSidebarItem } from "@/components/layout/sidebar-types";

type AppSidebarProps = {
  pathname: string;
  items: AppSidebarItem[];
  homeHref: string;
  brandProductName: string;
  userLabel: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

function buildStructuredSidebar(items: AppSidebarItem[]) {
  const operativo: AppSidebarItem[] = [];
  const amministrazione: AppSidebarItem[] = [];
  const extra: AppSidebarItem[] = [];

  for (const item of items) {
    const section = String(item.section || "").trim().toLowerCase();
    if (section === "operativo") {
      operativo.push(item);
      continue;
    }
    if (section === "amministrazione") {
      amministrazione.push(item);
      continue;
    }
    extra.push(item);
  }

  return { operativo, amministrazione, extra };
}

function BrandMark() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.75rem] bg-[linear-gradient(160deg,#111827,#1f2937)] text-xs font-semibold text-white shadow-[0_8px_18px_-10px_rgba(17,24,39,0.9)]">
      H
    </span>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return null;
  }

  return (
    <p className="mb-1 px-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
      {label}
    </p>
  );
}

export function AppSidebar({
  pathname,
  items,
  homeHref,
  brandProductName,
  userLabel,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: AppSidebarProps) {
  const structuredItems = useMemo(() => buildStructuredSidebar(items), [items]);
  const hasTopItems = structuredItems.operativo.length > 0;
  const hasAdminItems = structuredItems.amministrazione.length > 0;
  const hasExtraItems = structuredItems.extra.length > 0;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Chiudi menu"
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex border-r border-[var(--sidebar-border-color)] bg-[var(--sidebar-bg)] transition-[width,transform] duration-300 lg:translate-x-0 ${
          collapsed ? "w-[5.25rem] lg:w-[5.25rem]" : "w-[16.75rem] lg:w-[16.75rem]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <div className="flex w-full flex-col p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Link href={homeHref} className={`inline-flex min-w-0 items-center gap-2 ${collapsed ? "px-1" : "px-1.5 py-1"}`}>
              <BrandMark />
              {!collapsed ? (
                <span className="truncate text-[13px] font-semibold tracking-[0.01em] text-[var(--ui-text)]">
                  {brandProductName}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              className="hidden h-8 w-8 items-center justify-center rounded-[0.65rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-text)] lg:inline-flex"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Espandi sidebar" : "Comprimi sidebar"}
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                {collapsed ? (
                  <path d="M8.3 5.9L12.4 10l-4.1 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M11.7 5.9L7.6 10l4.1 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          </div>

          {!collapsed ? (
            <div className="mb-3">
              <label className="flex items-center gap-2 rounded-[0.75rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-2.5 py-2 text-[12px] text-[var(--ui-muted)]">
                <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <circle cx="8.6" cy="8.6" r="4.6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12.3 12.2L16 15.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="truncate">Search...</span>
                <span className="ml-auto rounded-[0.35rem] border border-[var(--ui-border)] px-1 py-0.5 text-[10px] leading-none">⌘K</span>
              </label>
            </div>
          ) : null}

          <nav className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Navigazione principale">
            {hasTopItems ? (
              <section className="mb-3">
                <SectionLabel label="Operativo" collapsed={collapsed} />
                <SidebarMenuList
                  items={structuredItems.operativo}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onCloseMobile}
                />
              </section>
            ) : null}

            {hasAdminItems ? (
              <section className="mb-3">
                <SectionLabel label="Amministrazione" collapsed={collapsed} />
                <SidebarMenuList
                  items={structuredItems.amministrazione}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onCloseMobile}
                />
              </section>
            ) : null}

            {hasExtraItems ? (
              <section>
                <SectionLabel label="Altro" collapsed={collapsed} />
                <SidebarMenuList
                  items={structuredItems.extra}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onCloseMobile}
                />
              </section>
            ) : null}
          </nav>

          <SidebarFooter userLabel={userLabel} collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
