"use client";

import type { UserRole } from "@/features/auth/session";

export type AppSidebarItem = {
  key: string;
  label: string;
  href: string;
  roles?: UserRole[];
  icon?: string;
  badge?: string | number;
  expanded?: boolean;
  children?: AppSidebarItem[];
};

export function isSidebarItemActive(pathname: string, item: Pick<AppSidebarItem, "href" | "children">): boolean {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  return item.children?.some((child) => isSidebarItemActive(pathname, child)) ?? false;
}

export function filterSidebarItemsByRole(items: AppSidebarItem[], role: UserRole): AppSidebarItem[] {
  return items
    .filter((item) => !item.roles || item.roles.includes(role))
    .map((item) => ({
      ...item,
      children: item.children ? filterSidebarItemsByRole(item.children, role) : undefined,
    }));
}
