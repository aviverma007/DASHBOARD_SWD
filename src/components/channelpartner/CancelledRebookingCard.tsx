import type { CpSummary } from "../../utils/cpLogic";

interface CancelledRebookingCardProps {
  cancelled: number;
  rebooked: number;
  stillVacant: number;
  cancelledTsv: number;
  topCancelled: CpSummary[];
  onCpClick?: (cpIdx: number) => void;
}

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 420, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function CancelledRebookingCard({ cancelled, rebooked, stillVacant, cancelledTsv, topCancelled, onCpClick }: CancelledRebookingCardProps) {
  const rebookedPct = cancelled ? Math.round((rebooked / cancelled) * 100) : 0;

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 14, flexShrink: 0 }}>CANCELLED &amp; REBOOKING STATUS</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16, flexShrink: 0 }}>
        <div style={{ background: "#fbe4e4", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 10.5, color: "#a13a3a", fontWeight: 700, letterSpacing: "0.5px" }}>CANCELLED</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "#a13a3a" }}>{cancelled}</div>
          <div style={{ fontSize: 10.5, color: "#a13a3a" }}>₹{(cancelledTsv / 1e7).toFixed(0)} Cr value</div>
        </div>
        <div style={{ background: "#f7ead9", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 10.5, color: "#8a531b", fontWeight: 700, letterSpacing: "0.5px" }}>REBOOKED</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "#8a531b" }}>{rebooked}</div>
          <div style={{ fontSize: 10.5, color: "#8a531b" }}>{rebookedPct}% of cancelled</div>
        </div>
        <div style={{ background: "#e2f3ec", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 10.5, color: "#0f6e56", fontWeight: 700, letterSpacing: "0.5px" }}>STILL VACANT</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "#0f6e56" }}>{stillVacant}</div>
          <div style={{ fontSize: 10.5, color: "#0f6e56" }}>back in inventory</div>
        </div>
      </div>

      {/* Rebooked vs vacant bar */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ background: "#eceff1", borderRadius: 5, height: 14, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${rebookedPct}%`, background: "#B8893C" }} />
          <div style={{ width: `${100 - rebookedPct}%`, background: "#c0392b", opacity: 0.7 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginTop: 4, color: "#6b7280" }}>
          <span>{rebookedPct}% rebooked</span>
          <span>{100 - rebookedPct}% still vacant</span>
        </div>
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4a5568", marginBottom: 8, flexShrink: 0 }}>TOP CHANNEL PARTNERS BY CANCELLATIONS</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {topCancelled.length === 0 && <p style={{ color: "#9ca3af", fontSize: 12.5 }}>No cancellations recorded.</p>}
        {topCancelled.map(cp => (
          <div key={cp.cpIdx} onClick={() => onCpClick?.(cp.cpIdx)}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, cursor: onCpClick ? "pointer" : "default", padding: "4px 0" }}>
            <span style={{ color: "#14213d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "65%" }}>{cp.name}</span>
            <span style={{ color: "#a13a3a", fontWeight: 700 }}>{cp.cancelled} cancelled{cp.rebooked > 0 ? ` · ${cp.rebooked} rebooked` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
