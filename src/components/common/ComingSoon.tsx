import { Construction } from "lucide-react";

interface ComingSoonProps {
  moduleName: string;
}

export function ComingSoon({ moduleName }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-white py-20 text-center">
      <Construction size={32} className="text-brand-blue/50" />
      <h2 className="mt-3 text-base font-semibold text-charcoal">{moduleName} — coming soon</h2>
      <p className="mt-1.5 max-w-sm text-sm text-charcoal-soft">
        This module is a placeholder in the current build. It will be developed once its
        requirements, source data, and KPI definitions are confirmed.
      </p>
    </div>
  );
}
