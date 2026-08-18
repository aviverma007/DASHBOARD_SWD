import { Bell, Menu, User } from "lucide-react";
import { useDataFreshness } from "../../hooks/useDataFreshness";
import { formatDateTime } from "../../utils/format";

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
}

export function Header({ onToggleSidebar, onOpenMobileNav }: HeaderProps) {
  const { data: freshness } = useDataFreshness();

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-white">
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          onClick={onOpenMobileNav}
          className="rounded-md p-2 text-charcoal-soft hover:bg-surface lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <button
          onClick={onToggleSidebar}
          className="hidden rounded-md p-2 text-charcoal-soft hover:bg-surface lg:block"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-sm font-bold text-white">
            SW
          </div>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-bold text-navy">SWD Analytics</span>
            <span className="text-[11px] text-charcoal-soft">Inventory &amp; Sales</span>
          </div>
        </div>

        <div className="flex-1" />

        <div className="hidden items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-charcoal-soft md:flex">
          <span
            className="freshness-pulse h-1.5 w-1.5 rounded-full bg-teal"
            aria-hidden="true"
          />
          {freshness ? (
            <span>Data as of {formatDateTime(freshness.lastRefreshed)}</span>
          ) : (
            <span>Loading data status…</span>
          )}
        </div>

        <button
          className="rounded-md p-2 text-charcoal-soft hover:bg-surface"
          aria-label="Notifications"
        >
          <Bell size={19} />
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue"
          aria-label="User profile"
        >
          <User size={17} />
        </button>
      </div>
    </header>
  );
}
