import type { ProjectStats, OverallStats } from "../../utils/pdrnLogic";
import { fArea, fCr } from "../../utils/pdrnLogic";

interface KpiTableProps {
  stats: ProjectStats | OverallStats;
  label: string; // "Overall" or project name
  onClick?: () => void;
  accent?: string;
  isProject?: boolean;
}

/** Renders the SOLD / UNSOLD / TOTAL × AREA / UNIT / %age / TSV table from the blueprint.
 * Used for both the Overall card and each project card. */
export function KpiTable({ stats, label, onClick, accent = "var(--gold)", isProject }: KpiTableProps) {
  const { sold, unsold, total, soldPct } = stats;
  const tsv = sold.tsv;

  const rows = [
    {
      label: "SOLD",
      area: fArea(sold.area),
      units: sold.units.toLocaleString("en-IN"),
      pct: total.units ? Math.round((sold.units / total.units) * 100) + "%" : "—",
      color: "var(--av)",
    },
    {
      label: "UNSOLD",
      area: fArea(unsold.area),
      units: unsold.units.toLocaleString("en-IN"),
      pct: total.units ? Math.round((unsold.units / total.units) * 100) + "%" : "—",
      color: "var(--bk)",
    },
    {
      label: "TOTAL",
      area: fArea(total.area),
      units: total.units.toLocaleString("en-IN"),
      pct: "100%",
      color: "var(--ink)",
    },
  ];

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        borderTopColor: accent,
        borderTopWidth: 3,
        cursor: onClick ? "pointer" : "default",
        padding: "14px 16px 16px",
      }}
    >
      {/* Card title */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: isProject ? 14.5 : 16,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.3,
            }}
          >
            {label}
          </div>
          {tsv > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--gold)", fontWeight: 600, marginTop: 2 }}>
              TSV {fCr(tsv)}
            </div>
          )}
          {tsv === 0 && isProject && (
            <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2 }}>
              No sales recorded
            </div>
          )}
        </div>
        {onClick && (
          <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, marginTop: 2 }}>
            Click to drill ›
          </span>
        )}
      </div>

      {/* Table */}
      <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                fontSize: 11,
                color: "var(--mut)",
                fontWeight: 400,
                paddingBottom: 6,
                paddingRight: 8,
              }}
            >
              &nbsp;
            </th>
            <th
              style={{
                textAlign: "right",
                fontSize: 11,
                color: "var(--mut)",
                fontWeight: 400,
                paddingBottom: 6,
                paddingRight: 8,
              }}
            >
              AREA
            </th>
            <th
              style={{
                textAlign: "right",
                fontSize: 11,
                color: "var(--mut)",
                fontWeight: 400,
                paddingBottom: 6,
                paddingRight: 8,
              }}
            >
              UNITS
            </th>
            <th
              style={{
                textAlign: "right",
                fontSize: 11,
                color: "var(--mut)",
                fontWeight: 400,
                paddingBottom: 6,
              }}
            >
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} style={{ borderTop: "1px solid var(--line)" }}>
              <td
                style={{
                  padding: "7px 8px 7px 0",
                  fontWeight: 700,
                  fontSize: 11.5,
                  color: row.color,
                  letterSpacing: "0.5px",
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  padding: "7px 8px",
                  textAlign: "right",
                  fontFamily: "Georgia,serif",
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                }}
              >
                {row.area}
              </td>
              <td
                style={{
                  padding: "7px 8px",
                  textAlign: "right",
                  fontFamily: "Georgia,serif",
                  fontWeight: row.label === "TOTAL" ? 700 : 400,
                  color: row.color,
                }}
              >
                {row.units}
              </td>
              <td
                style={{
                  padding: "7px 0 7px 8px",
                  textAlign: "right",
                  color: "var(--mut)",
                  fontFamily: "Georgia,serif",
                }}
              >
                {row.pct}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Absorption bar */}
      <div style={{ marginTop: 10 }}>
        <div className="track">
          <div className="a" style={{ width: `${soldPct}%` }} />
          <div className="b" style={{ width: `${100 - soldPct}%` }} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--mut)",
            marginTop: 4,
          }}
        >
          <span style={{ color: "var(--av)" }}>{soldPct}% sold</span>
          <span style={{ color: "var(--bk)" }}>{100 - soldPct}% unsold</span>
        </div>
      </div>
    </div>
  );
}
