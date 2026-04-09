"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SidebarFooter } from "@/components/layout/sidebar-footer";
import { SidebarMenuList } from "@/components/layout/sidebar-menu-list";
import type { AppSidebarItem } from "@/components/layout/sidebar-types";

type AppSidebarProps = {
  pathname: string;
  items: AppSidebarItem[];
  brandProductName: string;
  userLabel: string;
};

function buildStructuredSidebar(items: AppSidebarItem[]): AppSidebarItem[] {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const consumed = new Set<string>();

  const dashboard = byKey.get("dashboard");
  const agenda = byKey.get("agenda");
  const clients = byKey.get("clients");
  const settings = byKey.get("settings");
  const billing = byKey.get("billing");
  const inventory = byKey.get("inventory");

  const rootItems: AppSidebarItem[] = [];

  if (dashboard) {
    consumed.add(dashboard.key);
    rootItems.push(dashboard);
  }

  if (agenda) {
    consumed.add(agenda.key);
    rootItems.push({ ...agenda, badge: 4 });
  }

  if (clients) {
    consumed.add(clients.key);
    rootItems.push(clients);
  }

  if (settings) {
    consumed.add(settings.key);
  }

  if (billing) {
    consumed.add(billing.key);
    rootItems.push(billing);
  }

  if (inventory) {
    consumed.add(inventory.key);
    rootItems.push(inventory);
  }

  const remaining = items.filter((item) => !consumed.has(item.key));
  return [...rootItems, ...remaining];
}

function BrandMark() {
  return (
    <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#0f172a] text-[8px] text-white">
      ▲
    </span>
  );
}

export function AppSidebar({ pathname, items, brandProductName, userLabel }: AppSidebarProps) {
  const structuredItems = useMemo(() => buildStructuredSidebar(items), [items]);
  const bottomSettingsItem = useMemo(() => {
    const settings = items.find((item) => item.key === "settings");
    if (!settings) {
      return null;
    }

    return {
      ...settings,
      badge: undefined,
      expanded: false,
      children: undefined,
    } satisfies AppSidebarItem;
  }, [items]);

  return (
    <aside
      className="flex w-full flex-col border-b border-[var(--sidebar-border-color)] bg-[var(--ui-panel-solid)] p-3 lg:w-[11.25rem] lg:border-r lg:border-b-0"
      style={{ fontFamily: "var(--sidebar-font-family)" }}
    >
      <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 px-1.5 py-1 text-[13px] font-semibold text-[var(--ui-text)]">
        <BrandMark />
        <span>{brandProductName}</span>
      </Link>

      <div className="mb-2">
        <label className="group flex h-8 items-center gap-1.5 rounded-[0.45rem] border border-[var(--sidebar-border-color)] bg-[var(--ui-bg)] px-2 text-[12px] text-[var(--ui-muted)]">
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <circle cx="8.6" cy="8.6" r="4.6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12.3 12.2L16 15.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="flex-1">Search...</span>
          <span className="rounded-[0.3rem] border border-[var(--sidebar-border-color)] px-1 py-0.5 text-[10px] leading-none">
            ⌘ K
          </span>
        </label>
      </div>

      <nav className="flex-1" aria-label="Navigazione">
        <SidebarMenuList items={structuredItems} pathname={pathname} />
      </nav>

      {bottomSettingsItem ? (
        <nav className="mb-2 border-t border-[var(--sidebar-border-color)] pt-2" aria-label="Impostazioni">
          <SidebarMenuList items={[bottomSettingsItem]} pathname={pathname} />
        </nav>
      ) : null}

      <SidebarFooter userLabel={userLabel} />
    </aside>
  );
}
