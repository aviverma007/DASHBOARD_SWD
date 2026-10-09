import { useMemo, useState } from "react";
import { REPORTS, getReportRows } from "../../features/reports/reportData";
import type { ReportMeta } from "../../features/reports/reportData";
import { downloadExcel } from "../../features/reports/ReportsPage";
import { Card, Empty, Ico, SearchBar, Sheet, useToast, Pill } from "../ui";
import { fN } from "../fmt";

const ICONS = ["Building2", "ReceiptText", "FileSignature", "Landmark", "HardHat", "Headset"];

function Preview({ report, onClose }: { report: ReportMeta | null; onClose: () => void }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => (report ? getReportRows(report.id) : []), [report]);
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const f = q.trim() ? rows.filter(r => cols.some(c => String(r[c] ?? "").toLowerCase().includes(q.toLowerCase()))) : rows;
  return (
    <Sheet open={!!report} onClose={() => { setQ(""); onClose(); }} title={report?.title ?? ""}>
      <SearchBar value={q} onChange={setQ} placeholder="Search in report" />
      <p className="m-sub" style={{ margin: "8px 2px" }}>Showing {fN(Math.min(f.length, 40))} of {fN(f.length)} rows</p>
      <div className="m-stack">
        {f.slice(0, 40).map((r, i) => (
          <div key={i} className="m-card" style={{ boxShadow: "none", background: "var(--m-soft)" }}>
            {cols.slice(0, 6).map(c => (
              <div key={c} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "3px 0" }}>
                <span style={{ color: "var(--m-mut)", flex: "0 0 auto" }}>{c}</span>
                <b style={{ textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}>{String(r[c] ?? "—")}</b>
              </div>
            ))}
          </div>
        ))}
        {!f.length && <Empty title="No rows match" />}
      </div>
    </Sheet>
  );
}

export default function Reports() {
  const [pv, setPv] = useState<ReportMeta | null>(null);
  const toast = useToast();
  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Reports</h1><p className="m-sub">Preview here or export to Excel</p></div>
      {REPORTS.map((r, i) => {
        const n = getReportRows(r.id).length;
        return (
          <Card key={r.id}>
            <div className="m-proj">
              <span className="m-row-i" style={{ width: 46, height: 46, borderRadius: 14 }}><Ico n={ICONS[i % ICONS.length]} size={22} /></span>
              <div className="m-proj-t"><b>{r.title}</b><small>{r.description}</small></div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "12px 0" }}>
              <Pill>{fN(n)} rows</Pill><span className="m-sub" style={{ margin: 0 }}>{r.lastUpdated}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="m-btn" onClick={() => setPv(r)}>Preview</button>
              <button type="button" className="m-btn pri" onClick={() => { downloadExcel(r); toast("Excel export started"); }}>Export</button>
            </div>
          </Card>
        );
      })}
      <Preview report={pv} onClose={() => setPv(null)} />
    </div>
  );
}
