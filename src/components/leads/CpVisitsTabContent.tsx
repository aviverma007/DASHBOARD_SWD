import { useMemo, useState } from "react";
import { CP_VISITS, cpVisitFunnel, breakdownBy } from "../../utils/leadLogic";
import type { CpVisitRecord } from "../../utils/leadLogic";
import { FunnelChart } from "./FunnelChart";
import { BreakdownBarChart } from "./BreakdownBarChart";
import { LeadDrillDrawer } from "./LeadDrillDrawer";
import type { LeadSource } from "./LeadDrillDrawer";

interface DrillState { title: string; filterFn: (r: CpVisitRecord) => boolean }

export function CpVisitsTabContent() {
  const [drill, setDrill] = useState<DrillState | null>(null);
  const records = CP_VISITS.records;

  const funnel = useMemo(() => cpVisitFunnel(records), [records]);
  const completed = useMemo(() => records.filter(r => r.status === "Completed"), [records]);

  const byProject = useMemo(() => breakdownBy(records, r => r.project, 15), [records]);
  const byCp = useMemo(() => breakdownBy(records, r => r.cp, 15), [records]);
  const bySubject = useMemo(() => breakdownBy(records, r => r.subject, 5), [records]);
  const byGallery = useMemo(() => breakdownBy(records, r => r.gallery || "Unspecified", 10), [records]);

  const completedPct = funnel.total > 0 ? ((completed.length / funnel.total) * 100).toFixed(1) : "0";
  const revisitPct = funnel.total > 0 ? (((records.filter(r => r.subject === "Site Revisit").length) / funnel.total) * 100).toFixed(1) : "0";
  const avgVisitors = records.length > 0 ? (records.reduce((s, r) => s + r.visitors, 0) / records.length).toFixed(1) : "0";

  function drillByStatus(status: string) {
    setDrill({ title: `CP Visits — ${status}`, filterFn: r => r.status === status });
  }
  function drillBy(dim: keyof CpVisitRecord, value: string) {
    setDrill({ title: `CP Visits — ${value}`, filterFn: r => String(r[dim]) === value });
  }

  return (
    <div>
      <div className="blkbar" style={{ marginBottom: 16 }}>
        CP visit records track visit logistics (Scheduled / In Progress / Completed) — this data source has no field indicating whether a visit later led to a booking, so this funnel intentionally stops at visit completion rather than guessing an outcome.
      </div>

      <div className="kpis">
        <div className="kpi" style={{ borderTopColor: "#1E3163", borderTopWidth: 3 }}>
          <div className="k">Total CP Visits</div>
          <div className="v" style={{ color: "#1E3163", fontSize: 22 }}>{funnel.total.toLocaleString("en-IN")}</div>
          <div className="s">logged by channel partners</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#1a7a4a", borderTopWidth: 3 }}>
          <div className="k">Completed</div>
          <div className="v" style={{ color: "#1a7a4a", fontSize: 22 }}>{completed.length.toLocaleString("en-IN")}</div>
          <div className="s">{completedPct}% of total</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#0e7490", borderTopWidth: 3 }}>
          <div className="k">Channel Partners</div>
          <div className="v" style={{ color: "#0e7490", fontSize: 22 }}>{new Set(records.map(r => r.cp)).size}</div>
          <div className="s">active in this data</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#B8893C", borderTopWidth: 3 }}>
          <div className="k">Revisit Rate</div>
          <div className="v" style={{ color: "#B8893C", fontSize: 22 }}>{revisitPct}%</div>
          <div className="s">of visits are repeat visits</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#7b1414", borderTopWidth: 3 }}>
          <div className="k">Avg Visitors / Visit</div>
          <div className="v" style={{ color: "#7b1414", fontSize: 22 }}>{avgVisitors}</div>
          <div className="s">people per gallery visit</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#8a531b", borderTopWidth: 3 }}>
          <div className="k">Scheduled</div>
          <div className="v" style={{ color: "#8a531b", fontSize: 22 }}>{(funnel.cumulative.find(s => s.stage === "Scheduled")?.count ?? 0).toLocaleString("en-IN")}</div>
          <div className="s">upcoming / awaiting visit</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FunnelChart
          title="CP VISIT FUNNEL — SCHEDULED TO COMPLETED"
          stages={funnel.cumulative}
          dropOff={funnel.other > 0 ? { label: "Open / status not recorded", count: funnel.other } : undefined}
          onStageClick={drillByStatus}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart title="CP VISITS BY PROJECT" rows={byProject} barColor="#0e7490" onRowClick={v => drillBy("project", v)} />
        <BreakdownBarChart title="TOP CHANNEL PARTNERS BY VISITS BROUGHT" rows={byCp} barColor="#B8893C" onRowClick={v => drillBy("cp", v)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart title="VISIT TYPE — FIRST VISIT VS REVISIT VS MEETING" rows={bySubject} barColor="#1a7a4a" onRowClick={v => drillBy("subject", v)} height={220} />
        <BreakdownBarChart title="VISITS BY SALES GALLERY" rows={byGallery} barColor="#7b1414" onRowClick={v => drillBy("gallery", v)} />
      </div>

      {drill && (
        <LeadDrillDrawer
          source={"cpvisits" as LeadSource}
          title={drill.title}
          filterFn={r => drill.filterFn(r as CpVisitRecord)}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
