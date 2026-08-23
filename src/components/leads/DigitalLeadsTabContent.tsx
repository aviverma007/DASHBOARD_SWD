import { useMemo, useState } from "react";
import { DIGITAL, digitalFunnel, breakdownBy } from "../../utils/leadLogic";
import type { DigitalRecord } from "../../utils/leadLogic";
import { FunnelChart } from "./FunnelChart";
import { BreakdownBarChart } from "./BreakdownBarChart";
import { LeadDrillDrawer } from "./LeadDrillDrawer";
import type { LeadSource } from "./LeadDrillDrawer";

interface DrillState { title: string; filterFn: (r: DigitalRecord) => boolean }

export function DigitalLeadsTabContent() {
  const [drill, setDrill] = useState<DrillState | null>(null);
  const records = DIGITAL.records;

  const funnel = useMemo(() => digitalFunnel(records), [records]);

  const bySource = useMemo(() => breakdownBy(records, r => r.subSource, 12), [records]);
  const byProject = useMemo(() => breakdownBy(records, r => r.project, 15), [records]);
  const byStatus = useMemo(() => breakdownBy(records, r => r.status, 6), [records]);

  const qualifiedRecords = useMemo(() => records.filter(r => r.status === "Qualified"), [records]);
  const bySourceQualified = useMemo(() => breakdownBy(qualifiedRecords, r => r.subSource, 12), [qualifiedRecords]);

  const qualifiedPct = funnel.total > 0 ? ((funnel.qualified / funnel.total) * 100).toFixed(1) : "0";
  const notQualifiedPct = funnel.total > 0 ? ((funnel.notQualified / funnel.total) * 100).toFixed(1) : "0";

  function drillByStage(stage: string) {
    setDrill({ title: `Digital Leads — ${stage}`, filterFn: r => r.stage === stage });
  }
  function drillBy(dim: keyof DigitalRecord, value: string) {
    setDrill({ title: `Digital Leads — ${value}`, filterFn: r => String(r[dim]) === value });
  }
  function drillByStatus(value: string) {
    setDrill({ title: `Digital Leads — ${value}`, filterFn: r => r.status === value });
  }

  return (
    <div>
      <div className="blkbar" style={{ marginBottom: 16 }}>
        {DIGITAL.sourceNote}. Earlier months are not present in this export.
      </div>

      <div className="kpis">
        <div className="kpi" style={{ borderTopColor: "#1E3163", borderTopWidth: 3 }}>
          <div className="k">Total Enquiries</div>
          <div className="v" style={{ color: "#1E3163", fontSize: 22 }}>{funnel.total.toLocaleString("en-IN")}</div>
          <div className="s">since Apr 2026</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#0e7490", borderTopWidth: 3 }}>
          <div className="k">Qualified</div>
          <div className="v" style={{ color: "#0e7490", fontSize: 22 }}>{funnel.qualified.toLocaleString("en-IN")}</div>
          <div className="s">{qualifiedPct}% of total</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#1a7a4a", borderTopWidth: 3 }}>
          <div className="k">Reached Site Visit</div>
          <div className="v" style={{ color: "#1a7a4a", fontSize: 22 }}>{(funnel.cumulative.find(s => s.stage === "Site Visit")?.count ?? 0).toLocaleString("en-IN")}</div>
          <div className="s">via digital enquiry</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#B8893C", borderTopWidth: 3 }}>
          <div className="k">Booked</div>
          <div className="v" style={{ color: "#B8893C", fontSize: 22 }}>{(funnel.cumulative.find(s => s.stage === "Booked")?.count ?? 0).toLocaleString("en-IN")}</div>
          <div className="s">reached booking stage</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#c0392b", borderTopWidth: 3 }}>
          <div className="k">Closed Lost</div>
          <div className="v" style={{ color: "#c0392b", fontSize: 22 }}>{funnel.closedLost.toLocaleString("en-IN")}</div>
          <div className="s">did not convert</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#8a531b", borderTopWidth: 3 }}>
          <div className="k">Not Qualified</div>
          <div className="v" style={{ color: "#8a531b", fontSize: 22 }}>{funnel.notQualified.toLocaleString("en-IN")}</div>
          <div className="s">{notQualifiedPct}% of total</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FunnelChart
          title="DIGITAL LEAD FUNNEL — ENQUIRY TO BOOKING"
          stages={funnel.cumulative}
          dropOff={{ label: "Closed Lost", count: funnel.closedLost }}
          onStageClick={drillByStage}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart title="ALL ENQUIRIES BY SOURCE / PLATFORM" rows={bySource} barColor="#0e7490" onRowClick={v => drillBy("subSource", v)} />
        <BreakdownBarChart title="QUALIFIED LEADS BY SOURCE / PLATFORM" rows={bySourceQualified} barColor="#1a7a4a" onRowClick={v => setDrill({ title: `Qualified — ${v}`, filterFn: r => r.status === "Qualified" && r.subSource === v })} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart title="ENQUIRIES BY PROJECT" rows={byProject} barColor="#B8893C" onRowClick={v => drillBy("project", v)} />
        <BreakdownBarChart title="ENQUIRIES BY CURRENT STATUS" rows={byStatus} barColor="#7b1414" onRowClick={drillByStatus} />
      </div>

      {drill && (
        <LeadDrillDrawer
          source={"digital" as LeadSource}
          title={drill.title}
          filterFn={r => drill.filterFn(r as DigitalRecord)}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
