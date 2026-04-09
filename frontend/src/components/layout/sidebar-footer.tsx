"use client";

type SidebarFooterProps = {
  userLabel: string;
};

function FooterItem({
  label,
  icon,
}: {
  label: string;
  icon: "feedback" | "help";
}) {
  return (
      <button
        type="button"
        className="group flex w-full items-center justify-between rounded-[0.55rem] px-2 py-1.5 text-left text-[12px] text-[var(--sidebar-item-color)] transition-colors hover:bg-[var(--sidebar-item-hover-bg)] hover:text-[var(--sidebar-item-hover-color)]"
      >
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
          {icon === "feedback" ? (
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M4.5 15.5h4l3.2-2.7h3.8a1 1 0 0 0 1-1V5.3a1 1 0 0 0-1-1h-11a1 1 0 0 0-1 1v9.2z" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <circle cx="10" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 13.3v.2M8.5 8.1a1.7 1.7 0 1 1 2.5 1.5c-.7.4-1 .7-1 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <span>{label}</span>
      </span>
      <span className="text-[10px] opacity-60">↗</span>
    </button>
  );
}

export function SidebarFooter({ userLabel }: SidebarFooterProps) {
  return (
    <footer className="mt-auto hidden border-t border-[var(--sidebar-border-color)] pt-2 lg:block">
      <div className="space-y-1">
        <FooterItem label="Feedback" icon="feedback" />
        <FooterItem label="Help & Support" icon="help" />
      </div>

      <button
        type="button"
        className="mt-2 flex w-full items-center justify-between rounded-[0.55rem] px-2 py-1.5 text-left transition-colors hover:bg-[var(--sidebar-item-hover-bg)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d7dade] text-[10px] font-semibold text-[#5d6570]">
            {userLabel.trim().charAt(0).toUpperCase() || "U"}
          </span>
          <span className="truncate text-[12px] font-medium text-[var(--ui-text)]">{userLabel}</span>
        </span>
        <span className="text-[11px] text-[var(--ui-muted)]">⌄</span>
      </button>
    </footer>
  );
}
