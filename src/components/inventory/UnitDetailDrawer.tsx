import type { InventoryUnit } from "../../types/inventoryRaw";
import { formatCrore, formatRupees, formatRatePerSqft } from "../../utils/format";

interface UnitDetailDrawerProps {
  unit: InventoryUnit | null;
  onClose: () => void;
  onBack?: () => void;
}

const STATUS_PILL: Record<InventoryUnit["status"], string> = {
  AVAILABLE: "bg-[#e2f3ec] text-[#0f6e56]",
  BOOKED: "bg-[#eee9df] text-[#6b6b6b]",
  MANAGEMENT: "bg-[#f7ead9] text-[#8a531b]",
};

const MANAGEMENT_SUBLABELS = ["On hold", "In progress", "Management unit"];

export function UnitDetailDrawer({ unit, onClose, onBack }: UnitDetailDrawerProps) {
  if (!unit) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(20,33,61,0.34)]" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-[min(760px,95vw)] overflow-auto bg-inv-bg shadow-[-14px_0_50px_rgba(20,33,61,0.28)]">
        <div className="sticky top-0 z-10 bg-inv-ink px-5 py-4 text-white">
          <button onClick={onClose} className="float-right text-2xl leading-none text-[#c7cedf]">
            ✕
          </button>
          <div style={{ fontFamily: "var(--font-serif-display)", fontSize: 19 }}>{unit.unitLabel}</div>
          <div className="mt-1 text-xs text-[#c7cedf]">{unit.projectName}</div>
        </div>

        <div className="px-5 py-4">
          {onBack && (
            <button onClick={onBack} className="mb-2.5 text-[13px] text-inv-gold">
              ‹ back to list
            </button>
          )}

          <div className="rounded-[13px] border border-inv-line bg-white p-4.5 shadow-[var(--shadow-inv-card)]">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] ${STATUS_PILL[unit.status]}`}>
              {unit.status === "AVAILABLE" ? "Available" : unit.status === "BOOKED" ? "Booked" : "Management"}
            </span>
            {unit.status === "MANAGEMENT" && unit.managementSubCategory !== undefined && (
              <span className="ml-2 text-xs text-inv-mut">
                ({MANAGEMENT_SUBLABELS[unit.managementSubCategory]})
              </span>
            )}

            <div className="mt-3 grid grid-cols-[160px_1fr] gap-y-2.5 gap-x-3.5 text-[13.5px]">
              <div className="text-inv-mut">Unit description</div>
              <div>{unit.unitLabel}</div>
              <div className="text-inv-mut">Project</div>
              <div>{unit.projectName}</div>
              <div className="text-inv-mut">Tower</div>
              <div>{unit.towerName || "—"}</div>
              <div className="text-inv-mut">Floor</div>
              <div>{unit.floorLabel}</div>
              <div className="text-inv-mut">Configuration</div>
              <div>
                {unit.configName}
                {unit.rateBand && <span className="ml-1.5 text-inv-mut">({unit.rateBand})</span>}
              </div>
              <div className="text-inv-mut">Unit type</div>
              <div>{unit.unitTypeName}</div>
              <div className="text-inv-mut">Total super area</div>
              <div>{unit.area.toLocaleString("en-IN")} sq ft</div>
              <div className="text-inv-mut">Total unit cost</div>
              <div>
                {formatCrore(unit.cost)} <span className="text-inv-mut">({formatRupees(unit.cost)})</span>
              </div>
              <div className="text-inv-mut">Rate</div>
              <div>{formatRatePerSqft(unit.cost, unit.area)}</div>
              <div className="text-inv-mut">Payment plan</div>
              <div>
                {unit.status === "BOOKED" && unit.paymentPlan ? (
                  unit.paymentPlan
                ) : (
                  <span className="text-inv-mut">— (applies to booked units)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
