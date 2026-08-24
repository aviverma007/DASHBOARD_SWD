import { useMemo, useState } from "react";
import { DIGITAL, digitalFunnel, digitalQualifiedBifurcation, breakdownBy } from "../../utils/leadLogic";
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
  const qualBif = useMemo(() => digitalQualifiedBifurcation(records), [records]);

  const totalEnquiry = records.length;
  const qualifiedCount = useMemo(() => records.filter(r => r.status === "Qualified").length, [records]);
  const notQualifiedCount = funnel.notQualified;
  const siteVisitCount = funnel.cumulative.find(s => s.stage === "Site Visit")?.count ?? 0;
  const inProgressCount = funnel.cumulative.find(s => s.stage === "In Progress")?.count ?? 0;

  const bySource = useMemo(() => breakdownBy(records, r => r.subSource, 12), [records]);
  const byProject = useMemo(() => breakdownBy(records, r => r.project, 15), [records]);
  const byStatus = useMemo(() => breakdownBy(records, r => r.status, 6), [records]);
  const bySourceQualified = useMemo(() => breakdownBy(qualBif.records, r => r.subSource, 12), [qualBif.records]);

  function drillByStatus(value: string) {
    setDrill({ title: `Digital Leads — ${value}`, filterFn: r => r.status === value });
  }
  function drillBy(dim: keyof DigitalRecord, value: string) {
    setDrill({ title: `Digital Leads — ${value}`, filterFn: r => String(r[dim]) === value });
  }
  // Qualified-bifurcation funnel is scoped to Status="Qualified" — clicking
  // any rung drills within that scope, by current Stage rank.
  function drillQualifiedStage(stage: string) {
    if (stage === "Total Qualified") {
      setDrill({ title: "Qualified Leads — Total", filterFn: r => r.status === "Qualified" });
      return;
    }
    const ladder = ["New", "In Progress", "Site Visit", "Booked"];
    const rank = ladder.indexOf(stage);
    setDrill({ title: `Qualified Leads — ${stage} and beyond`, filterFn: r => r.status === "Qualified" && ladder.indexOf(r.stage) >= rank });
  }

  return (
    <div>
      <div className="blkbar" style={{ marginBottom: 16 }}>
        {DIGITAL.sourceNote}. Earlier months are not present in this export.
      </div>

      <div className="kpis">
        <div className="kpi" style={{ borderTopColor: "#1E3163", borderTopWidth: 3 }}>
          <div className="k">Total Enquiry</div>
          <div className="v" style={{ color: "#1E3163", fontSize: 22 }}>{totalEnquiry.toLocaleString("en-IN")}</div>
          <div className="s">since Apr 2026</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#1a7a4a", borderTopWidth: 3 }}>
          <div className="k">Qualified</div>
          <div className="v" style={{ color: "#1a7a4a", fontSize: 22 }}>{qualifiedCount.toLocaleString("en-IN")}</div>
          <div className="s">{totalEnquiry > 0 ? ((qualifiedCount / totalEnquiry) * 100).toFixed(1) : "0"}% of total</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#c0392b", borderTopWidth: 3 }}>
          <div className="k">Not Qualified</div>
          <div className="v" style={{ color: "#c0392b", fontSize: 22 }}>{notQualifiedCount.toLocaleString("en-IN")}</div>
          <div className="s">{totalEnquiry > 0 ? ((notQualifiedCount / totalEnquiry) * 100).toFixed(1) : "0"}% of total</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#0e7490", borderTopWidth: 3 }}>
          <div className="k">Site Visit</div>
          <div className="v" style={{ color: "#0e7490", fontSize: 22 }}>{siteVisitCount.toLocaleString("en-IN")}</div>
          <div className="s">reached site visit or beyond</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#B8893C", borderTopWidth: 3 }}>
          <div className="k">In Progress</div>
          <div className="v" style={{ color: "#B8893C", fontSize: 22 }}>{inProgressCount.toLocaleString("en-IN")}</div>
          <div className="s">reached in progress or beyond</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FunnelChart
          title="QUALIFIED BIFURCATION — WHERE QUALIFIED LEADS STAND"
          stages={qualBif.cumulative}
          dropOff={{ label: "Closed Lost (within Qualified leads)", count: qualBif.closedLost }}
          onStageClick={drillQualifiedStage}
        />
      </div>

      <div className="blkbar" style={{ marginBottom: 16 }}>
        Further bifurcation — how the {totalEnquiry.toLocaleString("en-IN")} enquiries and {qualifiedCount.toLocaleString("en-IN")} qualified leads break down by source, project, and status.
      </div>

      <div className="resp-grid2" style={{ gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart title="ALL ENQUIRIES BY SOURCE / PLATFORM" rows={bySource} barColor="#0e7490" onRowClick={v => drillBy("subSource", v)} />
        <BreakdownBarChart title="QUALIFIED LEADS BY SOURCE / PLATFORM" rows={bySourceQualified} barColor="#1a7a4a" onRowClick={v => setDrill({ title: `Qualified — ${v}`, filterFn: r => r.status === "Qualified" && r.subSource === v })} />
      </div>

      <div className="resp-grid2" style={{ gap: 18, marginBottom: 18 }}>
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
