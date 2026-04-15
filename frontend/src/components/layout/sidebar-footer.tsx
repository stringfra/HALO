"use client";

import { useState } from "react";
import { logoutCurrentSession } from "@/features/auth/api";

type SidebarFooterProps = {
  userLabel: string;
  collapsed: boolean;
};

function FooterAction({
  label,
  icon,
  collapsed,
}: {
  label: string;
  icon: "help" | "feedback";
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      className={`group flex w-full items-center rounded-[0.7rem] text-left text-[12px] text-[var(--sidebar-item-color)] transition-colors hover:bg-[var(--sidebar-item-hover-bg)] hover:text-[var(--sidebar-item-hover-color)] ${
        collapsed ? "h-9 justify-center px-0" : "h-9 justify-between px-2"
      }`}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
    >
      <span className={`inline-flex items-center ${collapsed ? "" : "gap-1.5"}`}>
        {icon === "feedback" ? (
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path d="M4.5 15.5h4l3.2-2.7h3.8a1 1 0 0 0 1-1V5.3a1 1 0 0 0-1-1h-11a1 1 0 0 0-1 1v9.2z" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <circle cx="10" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10 13.3v.2M8.5 8.1a1.7 1.7 0 1 1 2.5 1.5c-.7.4-1 .7-1 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        )}
        {!collapsed ? <span>{label}</span> : null}
      </span>
      {!collapsed ? <span className="text-[10px] opacity-60">↗</span> : null}
    </button>
  );
}

export function SidebarFooter({ userLabel, collapsed }: SidebarFooterProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const onLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    await logoutCurrentSession();
    setIsLoggingOut(false);
  };

  return (
    <footer className="mt-auto border-t border-[var(--sidebar-border-color)] pt-2">
      <div className="mb-1 space-y-1">
        <FooterAction label="Feedback" icon="feedback" collapsed={collapsed} />
        <FooterAction label="Supporto" icon="help" collapsed={collapsed} />
      </div>

      <div className={`rounded-[0.8rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] ${collapsed ? "p-1.5" : "p-2"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#dbe5f1,#edf2f7)] text-[11px] font-semibold text-[#3b4453]">
            {userLabel.trim().charAt(0).toUpperCase() || "U"}
          </span>
          {!collapsed ? (
            <span className="min-w-0 truncate text-[12px] font-medium text-[var(--ui-text)]">
              {userLabel}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          className={`mt-2 w-full rounded-[0.65rem] border border-[var(--ui-border)] text-[12px] font-medium text-[var(--ui-muted)] transition-colors hover:bg-[var(--sidebar-item-hover-bg)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-70 ${
            collapsed ? "h-8 px-0" : "h-8 px-2"
          }`}
          onClick={onLogout}
          disabled={isLoggingOut}
          title={collapsed ? "Esci" : undefined}
          aria-label={collapsed ? "Esci" : undefined}
        >
          {isLoggingOut ? "Uscita..." : collapsed ? "↩" : "Esci"}
        </button>
      </div>
    </footer>
  );
}
