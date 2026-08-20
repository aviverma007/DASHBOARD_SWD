import { useState } from "react";
import * as XLSX from "xlsx";
import { REPORTS, getReportRows } from "./reportData";
import type { ReportMeta } from "./reportData";

/** Download report rows as a formatted .xlsx file via SheetJS */
function downloadExcel(report: ReportMeta) {
  const rows = getReportRows(report.id);
  if (!rows.length) return;

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0]).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.slice(0, 200).map((r) => String(r[key] ?? "").length)
    ) + 2,
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, report.title.slice(0, 31));

  // Add a metadata sheet
  const metaRows = [
    { Field: "Report", Value: report.title },
    { Field: "Description", Value: report.description },
    { Field: "Data as of", Value: report.lastUpdated },
    { Field: "Downloaded at", Value: new Date().toLocaleString("en-IN") },
    { Field: "Total rows", Value: rows.length },
  ];
  const metaWs = XLSX.utils.json_to_sheet(metaRows);
  metaWs["!cols"] = [{ wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, metaWs, "Report Info");

  XLSX.writeFile(wb, `SWD_${report.id}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── In-app table preview ────────────────────────────────────────────────────

function ReportPreview({ report, onClose }: { report: ReportMeta; onClose: () => void }) {
  const rows = getReportRows(report.id);
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? rows.filter((r) =>
        cols.some((c) => String(r[c] ?? "").toLowerCase().includes(search.toLowerCase()))
      )
    : rows;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10,15,30,0.6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 1200,
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 48px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid #e4e0d6",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 26 }}>{report.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#14213d" }}>
              {report.title}
            </div>
            <div style={{ fontSize: 12, color: "#8a8f9e", marginTop: 2 }}>
              {filtered.length} rows{search ? ` matching "${search}"` : ` · ${report.lastUpdated}`}
            </div>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd8ce",
              fontSize: 13,
              outline: "none",
              width: 180,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => downloadExcel(report)}
            style={{
              padding: "9px 18px",
              borderRadius: 9,
              border: "none",
              background: "#1E3163",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#B8893C")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E3163")}
          >
            ⬇ Download Excel
          </button>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#8a8f9e",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <thead>
              <tr style={{ position: "sticky", top: 0 }}>
                {cols.map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      background: "#f4f2ed",
                      color: "#4a5568",
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      borderBottom: "2px solid #e4e0d6",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #f0ede6", background: i % 2 === 0 ? "#fff" : "#faf9f6" }}
                >
                  {cols.map((col) => (
                    <td
                      key={col}
                      style={{
                        padding: "8px 14px",
                        color: "#14213d",
                        whiteSpace: "nowrap",
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length > 500 && (
                <tr>
                  <td
                    colSpan={cols.length}
                    style={{ padding: "12px 14px", textAlign: "center", color: "#8a8f9e", fontSize: 12 }}
                  >
                    Showing first 500 of {filtered.length} rows — download Excel for the full dataset.
                  </td>
                </tr>
              )}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={cols.length}
                    style={{ padding: "32px 14px", textAlign: "center", color: "#8a8f9e" }}
                  >
                    No rows match "{search}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Report card ─────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onPreview,
}: {
  report: ReportMeta;
  onPreview: (r: ReportMeta) => void;
}) {
  const rowCount = getReportRows(report.id).length;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e4e0d6",
        borderRadius: 14,
        padding: "22px 22px 18px",
        boxShadow: "0 1px 3px rgba(20,33,61,.06), 0 4px 16px rgba(20,33,61,.07)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Icon + title */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "#f4f2ed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            flexShrink: 0,
          }}
        >
          {report.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 16,
              fontWeight: 700,
              color: "#14213d",
              marginBottom: 4,
            }}
          >
            {report.title}
          </div>
          <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5 }}>
            {report.description}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9ca3af" }}>
        <span>📦 {rowCount.toLocaleString("en-IN")} rows</span>
        <span>🕐 {report.lastUpdated}</span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onPreview(report)}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 9,
            border: "1.5px solid #1E3163",
            background: "#fff",
            color: "#1E3163",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background 0.14s, color 0.14s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1E3163";
            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#fff";
            (e.currentTarget as HTMLButtonElement).style.color = "#1E3163";
          }}
        >
          👁 Preview
        </button>
        <button
          onClick={() => downloadExcel(report)}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 9,
            border: "none",
            background: "#B8893C",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background 0.14s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#9a7230")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#B8893C")}
        >
          ⬇ Download Excel
        </button>
      </div>
    </div>
  );
}

// ── Main Reports page ───────────────────────────────────────────────────────

export function ReportsPage() {
  const [preview, setPreview] = useState<ReportMeta | null>(null);

  return (
    <div style={{ padding: "32px 28px", maxWidth: 960, margin: "0 auto", fontFamily: "inherit" }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 24,
            fontWeight: 700,
            color: "#14213d",
            marginBottom: 6,
          }}
        >
          Reports
        </div>
        <div style={{ fontSize: 13.5, color: "#6b7280" }}>
          Download or preview project and sales data as formatted Excel reports. More reports will
          be added here as data becomes available.
        </div>
      </div>

      {/* Report cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: 18,
        }}
      >
        {REPORTS.map((r) => (
          <ReportCard key={r.id} report={r} onPreview={setPreview} />
        ))}

        {/* Placeholder for future reports */}
        <div
          style={{
            background: "#faf9f6",
            border: "1.5px dashed #ddd8ce",
            borderRadius: 14,
            padding: "28px 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            textAlign: "center",
            color: "#9ca3af",
            minHeight: 180,
          }}
        >
          <div style={{ fontSize: 32 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}>More reports coming</div>
          <div style={{ fontSize: 12.5 }}>
            Collections, Revenue, and Customer reports will appear here once their data is confirmed.
          </div>
        </div>
      </div>

      {/* In-app preview modal */}
      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
