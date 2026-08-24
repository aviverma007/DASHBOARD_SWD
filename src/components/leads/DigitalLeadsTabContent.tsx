import { useMemo, useState } from "react";
import { DIGITAL, digitalFunnel, digitalStatusBifurcation, digitalOtherStatusCounts, breakdownBy } from "../../utils/leadLogic";
import type { DigitalRecord, BreakdownRow } from "../../utils/leadLogic";
import { BreakdownBarChart } from "./BreakdownBarChart";
import { LeadDrillDrawer } from "./LeadDrillDrawer";
import type { LeadSource } from "./LeadDrillDrawer";

interface DrillState { title: string; filterFn: (r: DigitalRecord) => boolean }

// Display order requested for the Qualified stage bifurcation chart —
// "Qualified" itself as the top/total bar, then each Stage value labeled
// "Qualified Stage (X)".
const QUALIFIED_STAGE_ORDER = ["New", "Site Visit", "In Progress", "Inventory", "Booked", "Closed Lost", "Unstaged"];
const QUALIFIED_STAGE_LABEL: Record<string, string> = {
  "New": "Qualified Stage (New)",
  "Site Visit": "Qualified Stage (Site Visit)",
  "In Progress": "Qualified Stage (In Progress)",
  "Inventory": "Qualified Stage (Inventory)",
  "Booked": "Qualified Stage (Booked)",
  "Closed Lost": "Qualified Stage (Closed Lost)",
  "Unstaged": "Qualified Stage (Others) (blank)",
};

export function DigitalLeadsTabContent() {
  const [drill, setDrill] = useState<DrillState | null>(null);
  const records = DIGITAL.records;

  const funnel = useMemo(() => digitalFunnel(records), [records]);
  const qualBif = useMemo(() => digitalStatusBifurcation(records, "Qualified"), [records]);
  const otherStatuses = useMemo(() => digitalOtherStatusCounts(records), [records]);

  const totalEnquiry = records.length;
  const qualifiedCount = qualBif.total;
  const notQualifiedCount = funnel.notQualified;
  const siteVisitCount = funnel.cumulative.find(s => s.stage === "Site Visit")?.count ?? 0;
  const inProgressCount = funnel.cumulative.find(s => s.stage === "In Progress")?.count ?? 0;
  const bookedCount = funnel.cumulative.find(s => s.stage === "Booked")?.count ?? 0;

  // Chart 1: Qualified total + its stage breakdown, in one column
  const qualifiedChartRows: BreakdownRow[] = useMemo(() => {
    const rows: BreakdownRow[] = [{ key: "Qualified", count: qualBif.total, pct: 100 }];
    QUALIFIED_STAGE_ORDER.forEach(stage => {
      const entry = qualBif.cumulative.find(s => s.stage === stage);
      const count = entry?.count ?? 0;
      rows.push({ key: QUALIFIED_STAGE_LABEL[stage], count, pct: qualBif.total > 0 ? Math.round((count / qualBif.total) * 100) : 0 });
    });
    return rows;
  }, [qualBif]);

  // Chart 2: the other (non-Qualified) Status buckets
  const otherStatusRows: BreakdownRow[] = useMemo(
    () => otherStatuses.map(s => ({ key: s.status, count: s.count, pct: totalEnquiry > 0 ? Math.round((s.count / totalEnquiry) * 100) : 0 })),
    [otherStatuses, totalEnquiry]
  );

  const bySource = useMemo(() => breakdownBy(records, r => r.subSource, 12), [records]);
  const byProject = useMemo(() => breakdownBy(records, r => r.project, 15), [records]);
  const byStatus = useMemo(() => breakdownBy(records, r => r.status, 6), [records]);
  const bySourceQualified = useMemo(() => breakdownBy(qualBif.records, r => r.subSource, 12), [qualBif.records]);

  function drillBy(dim: keyof DigitalRecord, value: string) {
    setDrill({ title: `Digital Leads — ${value}`, filterFn: r => String(r[dim]) === value });
  }
  function drillByStatus(value: string) {
    setDrill({ title: `Digital Leads — ${value}`, filterFn: r => r.status === value });
  }
  function drillQualifiedRow(label: string) {
    if (label === "Qualified") {
      setDrill({ title: "Qualified — Total", filterFn: r => r.status === "Qualified" });
      return;
    }
    const stage = Object.entries(QUALIFIED_STAGE_LABEL).find(([, l]) => l === label)?.[0];
    setDrill({ title: `Qualified — ${label}`, filterFn: r => r.status === "Qualified" && r.stage === stage });
  }
  function drillOtherStatus(label: string) {
    if (label === "Others (no status)") {
      const known = new Set(["New", "In Progress", "Site Visit Scheduled", "Not Qualified", "Qualified"]);
      setDrill({ title: "Digital Leads — Others (no status)", filterFn: r => !known.has(r.status) });
      return;
    }
    drillByStatus(label);
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
        <div className="kpi" style={{ borderTopColor: "#7b1414", borderTopWidth: 3 }}>
          <div className="k">Booked</div>
          <div className="v" style={{ color: "#7b1414", fontSize: 22 }}>{bookedCount.toLocaleString("en-IN")}</div>
          <div className="s">{totalEnquiry > 0 ? ((bookedCount / totalEnquiry) * 100).toFixed(2) : "0"}% of total enquiry</div>
        </div>
      </div>

      <div className="blkbar" style={{ marginBottom: 16 }}>
        Full stage-wise bifurcation — every Stage value is shown, including zero-count ones, so nothing is hidden.
      </div>

      {/* Chart 1 — Qualified + its stage breakdown, one column */}
      <div style={{ marginBottom: 18 }}>
        <BreakdownBarChart
          title={`QUALIFIED (${qualBif.total.toLocaleString("en-IN")}) — STAGE BIFURCATION`}
          rows={qualifiedChartRows}
          barColor="#1a7a4a"
          onRowClick={drillQualifiedRow}
          height={420}
        />
      </div>

      {/* Chart 2 — the other Status buckets, stacked below Chart 1 */}
      <div style={{ marginBottom: 18 }}>
        <BreakdownBarChart
          title="OTHER STATUS — NUMBER OF ENQUIRIES"
          rows={otherStatusRows}
          barColor="#8a531b"
          onRowClick={drillOtherStatus}
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
