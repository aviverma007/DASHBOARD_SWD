import type { ProjectStats, OverallStats } from "../../utils/pdrnLogic";
import { fArea, fCr } from "../../utils/pdrnLogic";

interface KpiTableProps {
  stats: ProjectStats | OverallStats;
  label: string;
  onClick?: () => void;
  accent?: string;
  isProject?: boolean;
  isOverall?: boolean;
}

// Fixed colors per column — independent of the inventory palette
const SOLD_COLOR   = "#1a7a4a";   // green
const UNSOLD_COLOR = "#c97a1a";   // orange
const TOTAL_COLOR  = "#14213d";   // near-black

export function KpiTable({ stats, label, onClick, accent = "var(--gold)", isProject, isOverall }: KpiTableProps) {
  const { sold, unsold, total, soldPct } = stats;
  const tsv = sold.tsv;
  const unsoldPct = 100 - soldPct;

  const colStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: isOverall ? "0 28px" : "0 20px",
    borderLeft: "1px solid var(--line)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: isOverall ? 11 : 10,
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "var(--mut)",
    marginBottom: isOverall ? 6 : 4,
  };
  // Units number — bigger, same size for all three columns
  const numSize = isOverall ? 30 : 22;
  const metaSize = isOverall ? 13 : 11;  // area + % — same size as each other

  return (
    <div
      className="ov-row"
      onClick={onClick}
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderLeft: `${isOverall ? 6 : 4}px solid ${accent}`,
        borderRadius: 12,
        boxShadow: isOverall
          ? "0 2px 4px rgba(20,33,61,.06), 0 8px 28px rgba(20,33,61,.10)"
          : "var(--shadow)",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        padding: isOverall ? "20px 0 20px 22px" : "12px 0 12px 16px",
        gap: 0,
        transition: "box-shadow 0.15s, transform 0.15s",
        flex: isOverall ? "0 0 auto" : "1",
      }}
      onMouseEnter={onClick ? (e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 4px rgba(20,33,61,.06), 0 14px 40px rgba(20,33,61,.10)";
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow)";
      } : undefined}
    >
      {/* Label + TSV */}
      <div className="ov-row-head" style={{ width: isOverall ? 280 : isProject ? 220 : 260, flexShrink: 0, paddingRight: 16 }}>
        <div style={{
          fontFamily: "Georgia,serif",
          fontSize: isOverall ? 20 : isProject ? 13.5 : 15,
          fontWeight: 700,
          color: isOverall ? "var(--ink)" : "var(--ink-soft)",
          lineHeight: 1.25,
          marginBottom: isOverall ? 6 : 3,
        }}>
          {label}
        </div>
        {tsv > 0 ? (
          <div style={{ fontSize: isOverall ? 15 : 12, color: "var(--gold)", fontWeight: 600 }}>
            TSV {fCr(tsv)}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--mut)" }}>No sales recorded</div>
        )}
        {onClick && (
          <div style={{ fontSize: 10.5, color: "var(--gold)", marginTop: 4 }}>Click to drill ›</div>
        )}
      </div>

      {/* SOLD — green */}
      <div className="ov-row-metric" style={colStyle}>
        <div style={labelStyle}>SOLD</div>
        <div className="ov-num" style={{ fontFamily: "Georgia,serif", fontSize: numSize, fontWeight: 700, color: SOLD_COLOR, whiteSpace: "nowrap", lineHeight: 1.1 }}>
          {sold.units.toLocaleString("en-IN")}
          <span style={{ fontSize: metaSize, fontWeight: 400, color: SOLD_COLOR, opacity: 0.75, marginLeft: 4 }}>units</span>
        </div>
        <div style={{ marginTop: isOverall ? 5 : 3, whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: "Georgia,serif", fontSize: metaSize, fontWeight: 700, color: SOLD_COLOR }}>{soldPct}%</span>
          <span style={{ fontFamily: "Georgia,serif", fontSize: metaSize, color: "var(--mut)", marginLeft: 8 }}>{fArea(sold.area)}</span>
        </div>
      </div>

      {/* UNSOLD — orange */}
      <div className="ov-row-metric" style={colStyle}>
        <div style={labelStyle}>UNSOLD</div>
        <div className="ov-num" style={{ fontFamily: "Georgia,serif", fontSize: numSize, fontWeight: 700, color: UNSOLD_COLOR, whiteSpace: "nowrap", lineHeight: 1.1 }}>
          {unsold.units.toLocaleString("en-IN")}
          <span style={{ fontSize: metaSize, fontWeight: 400, color: UNSOLD_COLOR, opacity: 0.75, marginLeft: 4 }}>units</span>
        </div>
        <div style={{ marginTop: isOverall ? 5 : 3, whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: "Georgia,serif", fontSize: metaSize, fontWeight: 700, color: UNSOLD_COLOR }}>{unsoldPct}%</span>
          <span style={{ fontFamily: "Georgia,serif", fontSize: metaSize, color: "var(--mut)", marginLeft: 8 }}>{fArea(unsold.area)}</span>
        </div>
      </div>

      {/* TOTAL — near-black */}
      <div className="ov-row-metric" style={colStyle}>
        <div style={labelStyle}>TOTAL</div>
        <div className="ov-num" style={{ fontFamily: "Georgia,serif", fontSize: numSize, fontWeight: 700, color: TOTAL_COLOR, whiteSpace: "nowrap", lineHeight: 1.1 }}>
          {total.units.toLocaleString("en-IN")}
          <span style={{ fontSize: metaSize, fontWeight: 400, color: TOTAL_COLOR, opacity: 0.6, marginLeft: 4 }}>units</span>
        </div>
        <div style={{ marginTop: isOverall ? 5 : 3, whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: "Georgia,serif", fontSize: metaSize, color: "var(--mut)" }}>{fArea(total.area)}</span>
        </div>
      </div>

      {/* Absorption bar */}
      <div className="ov-row-abs" style={{
        width: isOverall ? 160 : 120,
        flexShrink: 0,
        padding: isOverall ? "0 22px 0 28px" : "0 16px 0 20px",
        borderLeft: "1px solid var(--line)",
      }}>
        <div style={{ fontSize: isOverall ? 11 : 10, color: "var(--mut)", letterSpacing: "0.5px", marginBottom: isOverall ? 8 : 5 }}>
          ABSORPTION
        </div>
        <div style={{ height: isOverall ? 14 : 10, borderRadius: 3, background: "var(--bg)", display: "flex", overflow: "hidden", marginBottom: isOverall ? 6 : 4 }}>
          <div style={{ height: "100%", width: `${soldPct}%`, background: SOLD_COLOR }} />
          <div style={{ height: "100%", width: `${unsoldPct}%`, background: UNSOLD_COLOR, opacity: 0.55 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: isOverall ? 12 : 10.5 }}>
          <span style={{ color: SOLD_COLOR, fontWeight: 700 }}>{soldPct}%</span>
          <span style={{ color: UNSOLD_COLOR, fontWeight: 700 }}>{unsoldPct}%</span>
        </div>
      </div>
    </div>
  );
}
