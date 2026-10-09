import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { canAccess } from "../../config/users";
import { DATA_AS_ON } from "../../config/dataInfo";
import { Ico, Section, Hero, Kpi, Insight, BarChart, Card, CardHead, Sparkline, Trend, HBars, Legend } from "../ui";
import { collectionTotals, overall, salesByMonth } from "../data";
import { cr, fN, inrCr, pct, pctN, shortName } from "../fmt";

const QUICK = [
  { p: "/bookings", l: "Bookings", i: "ReceiptText", t: "" },
  { p: "/inventory", l: "Inventory", i: "Building2", t: "g" },
  { p: "/sap-collections", l: "Collections", i: "IndianRupee", t: "t" },
  { p: "/cost", l: "Cost", i: "Wallet", t: "o" },
  { p: "/target", l: "Target", i: "Target", t: "g" },
  { p: "/channel-partners", l: "Partners", i: "Handshake", t: "" },
  { p: "/digital-leads", l: "Leads", i: "Zap", t: "o" },
  { p: "/case-management", l: "Cases", i: "Headset", t: "t" },
];

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const nav = useNavigate();
  const { userLabel, access } = useAuthStore();
  const first = (userLabel ?? "there").split("@")[0].split(/[\s._-]/)[0];
  const ov = useMemo(overall, []);
  const months = useMemo(() => salesByMonth(12), []);
  const coll = useMemo(collectionTotals, []);
  const can = (p: string) => canAccess(access, p);
  const last = months[months.length - 1], prev = months[months.length - 2];
  const mom = prev && prev.value > 0 ? ((last.value - prev.value) / prev.value) * 100 : 0;
  const top = [...ov.projects].sort((a, b) => b.sold.tsv - a.sold.tsv).slice(0, 5).filter(p => p.sold.tsv > 0);
  const tiles = QUICK.filter(q => can(q.p));

  return (
    <div className="m-stack">
      <div>
        <h1 className="m-h1">{greet()}, {first}</h1>
        <p className="m-sub">Portfolio snapshot · data as on {DATA_AS_ON}</p>
      </div>

      <Hero label="Total sales value" value={inrCr(ov.sold.tsv)} sub={`${fN(ov.sold.units)} units · ${(ov.sold.area / 1e5).toFixed(2)} L sq ft sold`}
        trend={<Trend v={mom} />}
        cells={[{ v: inrCr(last.value), l: `${last.label} sales` }, { v: fN(last.units), l: `${last.label} units` }, { v: ov.rate.avg ? `₹${fN(ov.rate.avg)}` : "—", l: "Avg ₹/sq ft" }]}>
        <Sparkline values={months.map(m => m.value)} />
      </Hero>

      <div className="m-grid2">
        <Kpi label="Units sold" value={fN(ov.sold.units)} sub={`of ${fN(ov.total.units)}`} color="#1e3163" onClick={can("/bookings") ? () => nav("/bookings") : undefined} />
        <Kpi label="Available" value={fN(ov.unsold.units)} sub={`${(ov.unsold.area / 1e5).toFixed(2)} L sq ft`} color="#16a06f" accent onClick={can("/inventory") ? () => nav("/inventory") : undefined} />
      </div>

      <Section title="Health" />
      <div className="m-hscroll">
        <Insight label="Absorption" value={`${pct(ov.sold.units, ov.total.units)}`} sub={`${fN(ov.sold.units)} / ${fN(ov.total.units)} units`} pct={pctN(ov.sold.units, ov.total.units)} color="#1e3163" onClick={can("/inventory") ? () => nav("/inventory") : undefined} />
        <Insight label="Collected" value={pct(coll.recv, coll.called)} sub={`${inrCr(coll.recv)} of ${inrCr(coll.called)} demand`} pct={pctN(coll.recv, coll.called)} color="#16a06f" onClick={can("/sap-collections") ? () => nav("/sap-collections") : undefined} />
        <Insight label="BBA registered" value={pct(ov.bba.units, ov.sold.units)} sub={`${fN(ov.bba.units)} of ${fN(ov.sold.units)} sold`} pct={pctN(ov.bba.units, ov.sold.units)} color="#b8893c" />
      </div>

      <Card>
        <CardHead title="Monthly sales" sub="Last 12 months · tap a bar" />
        <BarChart data={months.map(m => ({ label: m.label, value: m.value }))} format={v => inrCr(v)} unit="sales value" />
      </Card>

      {top.length > 0 && (
        <Card>
          <CardHead title="Top projects by sales value" />
          <HBars rows={top.map(p => ({ label: shortName(p.projectName), value: p.sold.tsv, sub: `${fN(p.sold.units)} units sold · ${p.soldPct}% absorbed` }))} format={v => inrCr(v)} />
        </Card>
      )}

      <Card>
        <CardHead title="Collections position" sub="Active bookings" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          <div className="m-seg-bar">{[{ v: coll.recv, c: "#16a06f" }, { v: Math.max(coll.due, 0), c: "#d64545" }, { v: Math.max(coll.tcv - coll.called, 0), c: "#d5daea" }].map((p, i) => <i key={i} style={{ width: `${(p.v / (coll.tcv || 1)) * 100}%`, background: p.c }} />)}</div>
          <Legend items={[{ l: "Received", c: "#16a06f", v: cr(coll.recv / 1e7) }, { l: "Net due", c: "#d64545", v: cr(coll.due / 1e7) }, { l: "Future", c: "#d5daea", v: cr((coll.tcv - coll.called) / 1e7) }]} />
        </div>
      </Card>

      {tiles.length > 0 && <>
        <Section title="Quick actions" />
        <div className="m-card"><div className="m-tiles">
          {tiles.map(q => (
            <button key={q.p} type="button" className="m-tile" onClick={() => nav(q.p)}>
              <span className={`ic ${q.t}`}><Ico n={q.i} size={23} /></span><span>{q.l}</span>
            </button>
          ))}
        </div></div>
      </>}
    </div>
  );
}
