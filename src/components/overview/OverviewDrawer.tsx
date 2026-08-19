import { useDrilldownStore } from "../../store/drilldownStore";
import { OverviewDrawerContent } from "./OverviewDrawerContent";
import "../inventory/smartworldInventory.css";

/**
 * Replaces DrilldownDrawer.tsx. Same #ov/#dw/.dwh/.crumbs/.dwb shell as
 * Inventory's SwDrawer.tsx — reusing the same stylesheet (imported here
 * too; CSS imports are idempotent, so this doesn't duplicate anything)
 * rather than maintaining a second drawer visual language. Self-contained
 * in a .sw-inv wrapper so it renders correctly regardless of where in the
 * DOM tree it's mounted (AppShell renders it once, globally).
 *
 * Same useDrilldownStore-driven state as before — breadcrumb path,
 * open/close, popTo — only the presentation changed. The old fullscreen
 * toggle is dropped: Inventory's own drawer doesn't have one, it just
 * uses a fixed generous width (min(760px, 95vw)) that's wide enough for
 * the stack plan without needing to go full-screen.
 */
export function OverviewDrawer() {
  const { isOpen, path, close, popTo } = useDrilldownStore();

  if (!isOpen) return null;

  return (
    <div className="sw-inv">
      <div id="ov" className="open" onClick={close} />
      <div id="dw" className="open">
        <div className="dwh">
          <button className="x" onClick={close} aria-label="Close panel">
            ✕
          </button>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 19 }}>
            {path.length > 0 ? path[path.length - 1].label : "Overview"}
          </div>
          <div className="crumbs">
            {path.map((segment, index) => (
              <button key={`${segment.level}-${segment.id}`} className="crumb" onClick={() => popTo(index)}>
                {segment.label}
                {index < path.length - 1 && <span className="c">›</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="dwb">
          <OverviewDrawerContent />
        </div>
      </div>
    </div>
  );
}
