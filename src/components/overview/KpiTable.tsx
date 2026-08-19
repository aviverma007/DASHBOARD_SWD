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

/**
 * Full-width horizontal card — one row per card, SOLD/UNSOLD/TOTAL as
 * columns with AREA + UNITS + % inside each. Designed so 7 cards
 * (1 overall + 6 projects) stack vertically and fit on one screen.
 * isOverall gives the summary card ~2× height and larger typography.
 */
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
  const numStyle: React.CSSProperties = {
    fontFamily: "Georgia,serif",
    fontSize: isOverall ? 26 : 15,
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
  const subStyle: React.CSSProperties = {
    fontSize: isOverall ? 13 : 11.5,
    color: "var(--mut)",
    marginTop: isOverall ? 3 : 1,
    whiteSpace: "nowrap",
  };

  return (
    <div
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
        flex: isOverall ? "0 0 auto" : "1",          // overall is fixed height, projects share remainder
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
      <div style={{ width: isOverall ? 280 : isProject ? 220 : 260, flexShrink: 0, paddingRight: 16 }}>
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
          <div style={{ fontSize: 10.5, color: "var(--gold)", marginTop: 4 }}>
            Click to drill ›
          </div>
        )}
      </div>

      {/* SOLD */}
      <div style={colStyle}>
        <div style={labelStyle}>SOLD</div>
        <div style={{ ...numStyle, color: "var(--av)" }}>
          {sold.units.toLocaleString("en-IN")}{" "}
          <span style={{ fontWeight: 400, fontSize: isOverall ? 14 : 12, color: "var(--mut)" }}>units</span>
        </div>
        <div style={subStyle}>{fArea(sold.area)} · {soldPct}%</div>
      </div>

      {/* UNSOLD */}
      <div style={colStyle}>
        <div style={labelStyle}>UNSOLD</div>
        <div style={{ ...numStyle, color: "var(--bk)" }}>
          {unsold.units.toLocaleString("en-IN")}{" "}
          <span style={{ fontWeight: 400, fontSize: isOverall ? 14 : 12, color: "var(--mut)" }}>units</span>
        </div>
        <div style={subStyle}>{fArea(unsold.area)} · {unsoldPct}%</div>
      </div>

      {/* TOTAL */}
      <div style={colStyle}>
        <div style={labelStyle}>TOTAL</div>
        <div style={{ ...numStyle, color: "var(--ink)" }}>
          {total.units.toLocaleString("en-IN")}{" "}
          <span style={{ fontWeight: 400, fontSize: isOverall ? 14 : 12, color: "var(--mut)" }}>units</span>
        </div>
        <div style={subStyle}>{fArea(total.area)}</div>
      </div>

      {/* Absorption bar */}
      <div style={{
        width: isOverall ? 160 : 120,
        flexShrink: 0,
        padding: isOverall ? "0 22px 0 28px" : "0 16px 0 20px",
        borderLeft: "1px solid var(--line)",
      }}>
        <div style={{ fontSize: isOverall ? 11 : 10, color: "var(--mut)", letterSpacing: "0.5px", marginBottom: isOverall ? 8 : 5 }}>
          ABSORPTION
        </div>
        <div className="track" style={{ height: isOverall ? 14 : 10, marginBottom: isOverall ? 6 : 4 }}>
          <div className="a" style={{ width: `${soldPct}%` }} />
          <div className="b" style={{ width: `${unsoldPct}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: isOverall ? 12 : 10.5 }}>
          <span style={{ color: "var(--av)", fontWeight: 600 }}>{soldPct}%</span>
          <span style={{ color: "var(--bk)" }}>{unsoldPct}%</span>
        </div>
      </div>
    </div>
  );
}
