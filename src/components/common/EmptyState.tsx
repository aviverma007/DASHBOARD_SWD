import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: LucideIcon;
}

export function EmptyState({ title, message, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-white py-16 text-center">
      <Icon size={32} className="text-charcoal-soft/40" />
      <h3 className="mt-3 text-sm font-semibold text-charcoal">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-charcoal-soft">{message}</p>
    </div>
  );
}
