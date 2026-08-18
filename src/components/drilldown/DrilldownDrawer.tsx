import { X, Maximize2, Minimize2, ChevronRight } from "lucide-react";
import { useDrilldownStore } from "../../store/drilldownStore";
import { DrilldownContent } from "./DrilldownContent";
import clsx from "clsx";

export function DrilldownDrawer() {
  const { isOpen, isFullscreen, path, close, toggleFullscreen, popTo } = useDrilldownStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-charcoal/30" onClick={close} />

      <div
        className={clsx(
          "absolute inset-y-0 right-0 flex flex-col bg-white shadow-drawer transition-all",
          isFullscreen ? "left-0 w-full" : "w-full max-w-md"
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm scrollbar-thin">
            {path.map((segment, index) => (
              <span key={`${segment.level}-${segment.id}`} className="flex items-center gap-1 whitespace-nowrap">
                {index > 0 && <ChevronRight size={13} className="text-charcoal-soft/50" />}
                <button
                  onClick={() => popTo(index)}
                  className={clsx(
                    "rounded-md px-1.5 py-0.5 font-medium hover:bg-surface",
                    index === path.length - 1 ? "text-navy" : "text-charcoal-soft"
                  )}
                >
                  {segment.label}
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1 pl-2">
            <button
              onClick={toggleFullscreen}
              className="rounded-md p-1.5 text-charcoal-soft hover:bg-surface"
              aria-label={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={close}
              className="rounded-md p-1.5 text-charcoal-soft hover:bg-surface"
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <DrilldownContent />
        </div>
      </div>
    </div>
  );
}
