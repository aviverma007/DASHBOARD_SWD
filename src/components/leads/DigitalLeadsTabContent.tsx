import { useMemo, useState } from "react";
import { DIGITAL, digitalFunnel, digitalStatusBifurcation, breakdownBy } from "../../utils/leadLogic";
import type { DigitalRecord, BreakdownRow } from "../../utils/leadLogic";
import { BreakdownBarChart } from "./BreakdownBarChart";
import { LeadDrillDrawer } from "./LeadDrillDrawer";
import type { LeadSource } from "./LeadDrillDrawer";

interface DrillState { title: string; filterFn: (r: DigitalRecord) => boolean }

function toRows(cumulative: { stage: string; count: number }[], total: number): BreakdownRow[] {
  return cumulative.map(s => ({ key: s.stage, count: s.count, pct: total > 0 ? Math.round((s.count / total) * 100) : 0 }));
}

export function DigitalLeadsTabContent() {
  const [drill, setDrill] = useState<DrillState | null>(null);
  const records = DIGITAL.records;

  const funnel = useMemo(() => digitalFunnel(records), [records]);
  const newBif = useMemo(() => digitalStatusBifurcation(records, "New"), [records]);
  const qualBif = useMemo(() => digitalStatusBifurcation(records, "Qualified"), [records]);

  const totalEnquiry = records.length;
  const qualifiedCount = qualBif.total;
  const notQualifiedCount = funnel.notQualified;
  const siteVisitCount = funnel.cumulative.find(s => s.stage === "Site Visit")?.count ?? 0;
  const inProgressCount = funnel.cumulative.find(s => s.stage === "In Progress")?.count ?? 0;

  const newBifRows = useMemo(() => toRows(newBif.cumulative, newBif.total), [newBif]);
  const qualBifRows = useMemo(() => toRows(qualBif.cumulative, qualBif.total), [qualBif]);

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
  function drillNewStage(stage: string) {
    setDrill({ title: `New status — ${stage}`, filterFn: r => r.status === "New" && r.stage === stage });
  }
  function drillQualifiedStage(stage: string) {
    setDrill({ title: `Qualified — ${stage}`, filterFn: r => r.status === "Qualified" && r.stage === stage });
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

      <div className="blkbar" style={{ marginBottom: 16 }}>
        Full stage-wise bifurcation — every Stage value is shown for each Status group below, including zero-count ones, so nothing is hidden. Counts always sum back to the group's total.
      </div>

      <div className="resp-grid2" style={{ gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart
          title={`"NEW" STATUS (${newBif.total.toLocaleString("en-IN")}) — WHERE THEY STAND BY STAGE`}
          rows={newBifRows}
          barColor="#8a531b"
          onRowClick={drillNewStage}
          height={320}
        />
        <BreakdownBarChart
          title={`"QUALIFIED" STATUS (${qualBif.total.toLocaleString("en-IN")}) — WHERE THEY STAND BY STAGE`}
          rows={qualBifRows}
          barColor="#1a7a4a"
          onRowClick={drillQualifiedStage}
          height={320}
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
