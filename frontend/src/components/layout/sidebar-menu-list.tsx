"use client";

import Link from "next/link";
import { AppSidebarItem, isSidebarItemActive } from "@/components/layout/sidebar-types";

type SidebarMenuListProps = {
  items: AppSidebarItem[];
  pathname: string;
  nested?: boolean;
  collapsed?: boolean;
  depth?: number;
};

type IconName =
  | "dashboard"
  | "agenda"
  | "clients"
  | "settings"
  | "billing"
  | "inventory"
  | "generic";

function resolveIconName(item: AppSidebarItem): IconName {
  const key = (item.icon || item.key || "").toLowerCase();

  if (key.includes("dashboard") || key.includes("meter")) {
    return "dashboard";
  }
  if (key.includes("agenda") || key.includes("calendar")) {
    return "agenda";
  }
  if (key.includes("client") || key.includes("pazient") || key.includes("users")) {
    return "clients";
  }
  if (key.includes("setting") || key.includes("impost")) {
    return "settings";
  }
  if (key.includes("billing") || key.includes("fattur") || key.includes("coin")) {
    return "billing";
  }
  if (key.includes("invent") || key.includes("magazz") || key.includes("drawer")) {
    return "inventory";
  }

  return "generic";
}

function SidebarIcon({ name, className }: { name: IconName; className?: string }) {
  const base = "h-4 w-4 shrink-0";

  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={`${base} ${className || ""}`} aria-hidden="true">
        <rect x="3.5" y="3.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3.5v13M3.5 10h13" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }

  if (name === "agenda") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={`${base} ${className || ""}`} aria-hidden="true">
        <rect x="3.5" y="4.5" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 2.8v3.2M13.5 2.8v3.2M3.8 8.2h12.4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }

  if (name === "clients") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={`${base} ${className || ""}`} aria-hidden="true">
        <circle cx="7.2" cy="7.4" r="2.3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.8 14.9c.7-2 2.1-3 3.8-3 1.7 0 3.1 1 3.8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="13.8" cy="8.2" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={`${base} ${className || ""}`} aria-hidden="true">
        <circle cx="10" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 4.2v1.4M10 14.4v1.4M4.2 10h1.4M14.4 10h1.4M5.9 5.9l1 1M13.1 13.1l1 1M14.1 5.9l-1 1M6.9 13.1l-1 1"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "billing") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={`${base} ${className || ""}`} aria-hidden="true">
        <rect x="3.8" y="4.2" width="12.4" height="11.8" rx="2.4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.8 8.1h6.4M6.8 11h4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "inventory") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={`${base} ${className || ""}`} aria-hidden="true">
        <rect x="3.8" y="5.2" width="12.4" height="10.6" rx="2.3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.8 8.4h12.4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${base} ${className || ""}`} aria-hidden="true">
      <circle cx="10" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M5.8 8l4.2 4.2L14.2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SidebarMenuList({
  items,
  pathname,
  nested = false,
  collapsed = false,
  depth = 0,
}: SidebarMenuListProps) {
  const compactMode = collapsed && depth === 0;

  return (
    <ul className={nested ? "mt-1 flex flex-col gap-1 pl-7" : "flex flex-col gap-1"}>
      {items.map((item) => {
        const isActive = isSidebarItemActive(pathname, item);
        const hasChildren = Boolean(item.children?.length);
        const isExpanded = Boolean(item.expanded || isActive);
        const showInlineChildren = hasChildren && isExpanded && !compactMode;
        const showFlyoutChildren = hasChildren && compactMode;
        const iconName = resolveIconName(item);
        const isTopLevel = depth === 0;
        const isRootActive = isTopLevel && isActive;

        return (
          <li key={item.key} className={`list-none ${showFlyoutChildren ? "group relative" : ""}`}>
            <Link
              href={item.href}
              className={`group flex items-center rounded-[0.55rem] text-left transition-colors ${
                compactMode
                  ? "h-8 w-8 justify-center"
                  : nested
                    ? "h-7 px-2 text-[12px]"
                    : "h-9 px-2.5 text-[13px]"
              } ${
                isRootActive
                  ? "bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active-color)]"
                  : "text-[var(--sidebar-item-color)] hover:bg-[var(--sidebar-item-hover-bg)] hover:text-[var(--sidebar-item-hover-color)]"
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-haspopup={hasChildren ? "menu" : undefined}
              aria-expanded={hasChildren && !compactMode ? isExpanded : undefined}
              title={compactMode ? item.label : undefined}
            >
              {compactMode ? (
                <SidebarIcon name={iconName} />
              ) : (
                <>
                  {isTopLevel ? (
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                      <SidebarIcon name={iconName} />
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {typeof item.badge !== "undefined" && !hasChildren ? (
                    <span className="ml-2 rounded-[0.4rem] border border-[var(--sidebar-border-color)] bg-[var(--ui-panel-solid)] px-1.5 py-0.5 text-[10px] leading-none text-[var(--ui-muted)]">
                      {item.badge}
                    </span>
                  ) : null}
                  {hasChildren ? (
                    <span className="ml-1 text-[var(--ui-muted)]">
                      <Chevron expanded={isExpanded} />
                    </span>
                  ) : null}
                </>
              )}
            </Link>

            {showInlineChildren ? (
              <SidebarMenuList
                items={item.children || []}
                pathname={pathname}
                nested
                collapsed={false}
                depth={depth + 1}
              />
            ) : null}

            {showFlyoutChildren ? (
              <div className="pointer-events-none invisible absolute top-0 left-full z-50 ml-2 w-[var(--sidebar-submenu-width)] rounded-[0.6rem] border border-[var(--sidebar-border-color)] bg-[var(--ui-panel-solid)] p-1.5 opacity-0 shadow-[var(--shadow-soft)] transition-all duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100">
                <SidebarMenuList
                  items={item.children || []}
                  pathname={pathname}
                  nested
                  collapsed={false}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
