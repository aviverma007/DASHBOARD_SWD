import { useMemo, useState } from "react";
import {
  FOOTFALL, footfallFunnel, breakdownBy, ageBreakdown, FOOTFALL_LADDER,
} from "../../utils/leadLogic";
import type { FootfallRecord } from "../../utils/leadLogic";
import { FunnelChart } from "./FunnelChart";
import { BreakdownBarChart } from "./BreakdownBarChart";
import { LeadDrillDrawer } from "./LeadDrillDrawer";
import type { LeadSource } from "./LeadDrillDrawer";

interface DrillState { title: string; filterFn: (r: FootfallRecord) => boolean }

export function FootfallTabContent() {
  const [drill, setDrill] = useState<DrillState | null>(null);
  const records = FOOTFALL.records;

  const funnel = useMemo(() => footfallFunnel(records), [records]);
  const bookedRecords = useMemo(() => records.filter(r => r.stage === "Booked"), [records]);

  const byAge = useMemo(() => ageBreakdown(bookedRecords), [bookedRecords]);
  const byLocality = useMemo(() => breakdownBy(bookedRecords, r => r.locality, 12), [bookedRecords]);
  const byProject = useMemo(() => breakdownBy(bookedRecords, r => r.project, 15), [bookedRecords]);
  const byCategory = useMemo(() => breakdownBy(bookedRecords, r => r.category, 8), [bookedRecords]);
  const byChannel = useMemo(() => breakdownBy(bookedRecords, r => r.cp === "Direct" ? "Direct" : "Channel Partner", 2), [bookedRecords]);
  const byGallery = useMemo(() => breakdownBy(bookedRecords, r => r.gallery || "Unspecified", 10), [bookedRecords]);

  const conversionRate = funnel.total > 0 ? ((bookedRecords.length / funnel.total) * 100).toFixed(1) : "0";
  const siteVisitCount = funnel.cumulative.find(s => s.stage === "Site Visit")?.count ?? 0;
  const visitToBookPct = siteVisitCount > 0 ? ((bookedRecords.length / siteVisitCount) * 100).toFixed(1) : "0";

  function drillByStage(stage: string) {
    const rank = FOOTFALL_LADDER.indexOf(stage);
    setDrill({ title: `Footfall — ${stage} and beyond`, filterFn: r => FOOTFALL_LADDER.indexOf(r.stage) >= rank });
  }
  function drillBookedBy(dim: keyof FootfallRecord, value: string) {
    setDrill({ title: `Booked — ${value}`, filterFn: r => r.stage === "Booked" && String(r[dim]) === value });
  }
  function drillChannel(value: string) {
    setDrill({ title: `Booked — ${value}`, filterFn: r => r.stage === "Booked" && (value === "Direct" ? r.cp === "Direct" : r.cp !== "Direct") });
  }

  return (
    <div>
      <div className="kpis">
        <div className="kpi" style={{ borderTopColor: "#1E3163", borderTopWidth: 3 }}>
          <div className="k">Total Footfall</div>
          <div className="v" style={{ color: "#1E3163", fontSize: 22 }}>{funnel.total.toLocaleString("en-IN")}</div>
          <div className="s">opportunities logged</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#0e7490", borderTopWidth: 3 }}>
          <div className="k">Reached Site Visit</div>
          <div className="v" style={{ color: "#0e7490", fontSize: 22 }}>{siteVisitCount.toLocaleString("en-IN")}</div>
          <div className="s">at or beyond visit stage</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#1a7a4a", borderTopWidth: 3 }}>
          <div className="k">Booked</div>
          <div className="v" style={{ color: "#1a7a4a", fontSize: 22 }}>{bookedRecords.length.toLocaleString("en-IN")}</div>
          <div className="s">{conversionRate}% of total footfall</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#B8893C", borderTopWidth: 3 }}>
          <div className="k">Visit → Booking</div>
          <div className="v" style={{ color: "#B8893C", fontSize: 22 }}>{visitToBookPct}%</div>
          <div className="s">of site visits convert</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#c0392b", borderTopWidth: 3 }}>
          <div className="k">Closed Lost</div>
          <div className="v" style={{ color: "#c0392b", fontSize: 22 }}>{funnel.closedLost.toLocaleString("en-IN")}</div>
          <div className="s">did not convert</div>
        </div>
        <div className="kpi" style={{ borderTopColor: "#8a531b", borderTopWidth: 3 }}>
          <div className="k">Unstaged</div>
          <div className="v" style={{ color: "#8a531b", fontSize: 22 }}>{funnel.unstaged.toLocaleString("en-IN")}</div>
          <div className="s">no stage assigned yet</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FunnelChart
          title="FOOTFALL FUNNEL — ENQUIRY TO BOOKING"
          stages={funnel.cumulative}
          dropOff={{ label: "Closed Lost (dropped out along the way)", count: funnel.closedLost }}
          onStageClick={drillByStage}
        />
      </div>

      <div className="blkbar" style={{ marginBottom: 16 }}>
        The charts below profile the {bookedRecords.length.toLocaleString("en-IN")} leads that actually converted to a booking — what age, area, project, category, and channel they came from.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart title="BOOKED LEADS BY AGE GROUP" rows={byAge} barColor="#1E3163" onRowClick={v => drillBookedBy("age", v)} />
        <BreakdownBarChart title="BOOKED LEADS BY LOCALITY" rows={byLocality} barColor="#0e7490" onRowClick={v => drillBookedBy("locality", v)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart title="BOOKED LEADS BY PROJECT" rows={byProject} barColor="#B8893C" onRowClick={v => drillBookedBy("project", v)} />
        <BreakdownBarChart title="BOOKED LEADS BY LEAD CATEGORY" rows={byCategory} barColor="#7b1414" onRowClick={v => drillBookedBy("category", v)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
        <BreakdownBarChart title="BOOKED LEADS — DIRECT VS CHANNEL PARTNER" rows={byChannel} barColor="#1a7a4a" onRowClick={drillChannel} height={200} />
        <BreakdownBarChart title="BOOKED LEADS BY SALES GALLERY" rows={byGallery} barColor="#8a531b" onRowClick={v => drillBookedBy("gallery", v)} />
      </div>

      {drill && (
        <LeadDrillDrawer
          source={"footfall" as LeadSource}
          title={drill.title}
          filterFn={r => drill.filterFn(r as FootfallRecord)}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
