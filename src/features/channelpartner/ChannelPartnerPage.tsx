import { useMemo, useState } from "react";
import {
  summariseByChannelPartner, topByUnits, topByArea, topByTsv, topByCancelled,
  monthlyTrend, cancelledRebookingSummary, fArea, fCr,
} from "../../utils/cpLogic";
import { TopEntitiesBarChart } from "../../components/channelpartner/TopEntitiesBarChart";
import { CpMonthlyTrendCard } from "../../components/channelpartner/CpMonthlyTrendCard";
import { CancelledRebookingCard } from "../../components/channelpartner/CancelledRebookingCard";
import { CpDrillDrawer } from "../../components/channelpartner/CpDrillDrawer";
import "../../components/inventory/smartworldInventory.css";

const TOP_N = 12;

export function ChannelPartnerPage() {
  const [drillCpIdx, setDrillCpIdx] = useState<number | null>(null);

  const allCps = useMemo(() => summariseByChannelPartner().filter(s => s.name !== "Direct"), []);
  const directCp = useMemo(() => summariseByChannelPartner().find(s => s.name === "Direct"), []);

  const totalUnits = useMemo(() => allCps.reduce((s, c) => s + c.units, 0), [allCps]);
  const totalArea = useMemo(() => allCps.reduce((s, c) => s + c.area, 0), [allCps]);
  const totalTsv = useMemo(() => allCps.reduce((s, c) => s + c.tsv, 0), [allCps]);

  const cancelSummary = useMemo(() => cancelledRebookingSummary(), []);
  const topCancelled = useMemo(() => topByCancelled(8), []);

  const topUnits = useMemo(() => topByUnits(TOP_N, true), []);
  const topArea = useMemo(() => topByArea(TOP_N, true), []);
  const topTsv = useMemo(() => topByTsv(TOP_N, true), []);

  const trend = useMemo(() => monthlyTrend(true), []);

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)",
        padding: "18px 24px 20px",
        borderBottom: "3px solid var(--gold)",
      }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#fff", fontWeight: 700, marginBottom: 4 }}>
          Channel Partners
        </div>
        <div style={{ fontSize: 12.5, color: "#a9b2c7" }}>
          {allCps.length} channel partners · {totalUnits.toLocaleString("en-IN")} units sold via CPs · click any bar or row to drill down
        </div>
      </div>

      <div className="wrap">
        {/* KPI strip */}
        <div className="kpis">
          <div className="kpi" style={{ borderTopColor: "#1E3163", borderTopWidth: 3 }}>
            <div className="k">Channel Partners</div>
            <div className="v" style={{ color: "#1E3163", fontSize: 22 }}>{allCps.length}</div>
            <div className="s">active in portfolio</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#0e7490", borderTopWidth: 3 }}>
            <div className="k">CP Units Sold</div>
            <div className="v" style={{ color: "#0e7490", fontSize: 22 }}>{totalUnits.toLocaleString("en-IN")}</div>
            <div className="s">via channel partners</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#B8893C", borderTopWidth: 3 }}>
            <div className="k">CP Area Sold</div>
            <div className="v" style={{ color: "#B8893C", fontSize: 22 }}>{fArea(totalArea)}</div>
            <div className="s">total super area</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#7b1414", borderTopWidth: 3 }}>
            <div className="k">CP TSV</div>
            <div className="v" style={{ color: "#7b1414", fontSize: 22 }}>{fCr(totalTsv)}</div>
            <div className="s">total sale value</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#c0392b", borderTopWidth: 3 }}>
            <div className="k">Cancelled Units</div>
            <div className="v" style={{ color: "#c0392b", fontSize: 22 }}>{cancelSummary.cancelled}</div>
            <div className="s">all channels</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#1a7a4a", borderTopWidth: 3 }}>
            <div className="k">Rebooked Units</div>
            <div className="v" style={{ color: "#1a7a4a", fontSize: 22 }}>{cancelSummary.rebooked}</div>
            <div className="s">back into an active sale</div>
          </div>
        </div>

        {directCp && (
          <div className="blkbar" style={{ marginBottom: 14 }}>
            {directCp.units} units ({fArea(directCp.area)}, {fCr(directCp.tsv)}) were sold directly, without a channel partner — excluded from the CP figures above.
          </div>
        )}

        {/* Monthly trend */}
        <div style={{ marginBottom: 16 }}>
          <CpMonthlyTrendCard data={trend} />
        </div>

        {/* Top CP rankings */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
          <TopEntitiesBarChart
            title="TOP CHANNEL PARTNERS — UNITS SOLD"
            rows={topUnits}
            valueKey="units"
            formatValue={v => v.toLocaleString("en-IN")}
            barColor="#0e7490"
            onRowClick={setDrillCpIdx}
          />
          <TopEntitiesBarChart
            title="TOP CHANNEL PARTNERS — AREA SOLD (L SQFT)"
            rows={topArea}
            valueKey="area"
            formatValue={v => (v / 100000).toFixed(2)}
            barColor="#B8893C"
            onRowClick={setDrillCpIdx}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
          <TopEntitiesBarChart
            title="TOP CHANNEL PARTNERS — TSV (₹ CR)"
            rows={topTsv}
            valueKey="tsv"
            formatValue={v => (v / 1e7).toFixed(1)}
            barColor="#7b1414"
            onRowClick={setDrillCpIdx}
          />
          <CancelledRebookingCard
            cancelled={cancelSummary.cancelled}
            rebooked={cancelSummary.rebooked}
            stillVacant={cancelSummary.stillVacant}
            cancelledTsv={cancelSummary.cancelledTsv}
            topCancelled={topCancelled}
            onCpClick={setDrillCpIdx}
          />
        </div>
      </div>

      {drillCpIdx !== null && (
        <CpDrillDrawer cpIdx={drillCpIdx} onClose={() => setDrillCpIdx(null)} />
      )}
    </div>
  );
}
