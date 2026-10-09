import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import raw from "../../data/eoiData.json";
import {
  Card, CardHead, Section, Hero, Kpi, Seg, List, Row, SearchBar, Sheet, FilterBar, Empty, Pill, SegBar, Legend,
  Progress, BarChart, FullViewLink, type FilterField, type FilterValues,
} from "../ui";
import { fN, inrCr, pct, pctN } from "../fmt";

/* Same data + semantics as the desktop EOI page (and the assistant domain):
   pending = status 0, excluding pooled pass-through accounts; money in hand = cleared + adjustments + refunds,
   customers counted only when > ₹1,000. Customers are identified by customer code (no names). */
interface EoiFile { meta: { asOn: string }; PROJECTS: string[]; RS: string[]; MODE: string[]; C: (string | number)[][]; R: (string | number)[][] }
const D = raw as unknown as EoiFile;
const EPOCH = Date.UTC(2022, 0, 1), DAY = 86400000;
const AS_ON = Math.round((Date.UTC(2026, 8, 25) - EPOCH) / DAY);
const fD = (d: number) => (d < 0 ? "—" : new Date(EPOCH + d * DAY).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }));

interface Cust { idx: number; code: string; proj: number; status: 0 | 1 | 2; first: number; last: number; cleared: number; adj: number; refunds: number; bounced: number; n: number; net: number; age: number }
const ALL: Cust[] = D.C.map((c, idx) => {
  const cleared = c[8] as number, adj = c[9] as number, refunds = c[10] as number, first = c[6] as number;
  return {
    idx, code: String(c[0]), proj: c[1] as number, status: c[2] as 0 | 1 | 2, first, last: c[7] as number,
    cleared, adj, refunds, bounced: c[11] as number, n: c[12] as number, net: cleared + adj + refunds,
    age: first >= 0 ? Math.max(0, AS_ON - first) : 0,
  };
});
const isPool = (c: Cust) => c.n >= 100 && c.cleared > 0 && Math.abs(c.adj) >= 0.9 * c.cleared;
const REAL = ALL.filter(c => !isPool(c));
const PENDING = REAL.filter(c => c.status === 0);
const HOLDING = PENDING.filter(c => c.net > 1000);
const ZERO = PENDING.length - HOLDING.length;
const isEoiProj = (p: number) => D.PROJECTS[p] === "CODE 67 GURGAON";
const typeLbl = (p: number) => (isEoiProj(p) ? "EOI" : "Advance");
const pName = (p: number) => D.PROJECTS[p].replace("SMARTWORLD ", "").replace(/ (GURGAON|NOIDA)$/, m => ` ·${m.trim().slice(0, 3)}`).replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a + b.toLowerCase());
const BANDS = [
  { k: "0", l: "0–90 d", lo: 0, hi: 90, c: "#16a06f" }, { k: "1", l: "91–180 d", lo: 91, hi: 180, c: "#7bb661" },
  { k: "2", l: "181–270 d", lo: 181, hi: 270, c: "#eda100" }, { k: "3", l: "271–365 d", lo: 271, hi: 365, c: "#e07b39" },
  { k: "4", l: "Over 1 year", lo: 366, hi: 1e9, c: "#c0392b" },
];
const SHOW = 30;
type Sort = "hand" | "age";

export default function Eoi() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [f, setF] = useState<FilterValues>({});
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("hand");
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<Cust | null>(null);

  const fields: FilterField[] = useMemo(() => [
    { key: "proj", label: "Project", options: D.PROJECTS.map((_p, i) => ({ k: String(i), l: pName(i) })) },
    { key: "type", label: "Money type", options: [{ k: "adv", l: "Advance (RERA)" }, { k: "eoi", l: "EOI (Code 67)" }] },
    { key: "age", label: "Ageing", allLabel: "Any ageing", options: BANDS.map(b => ({ k: b.k, l: b.l })) },
  ], []);

  const scoped = useMemo(() => HOLDING.filter(c => {
    if (f.proj && String(c.proj) !== f.proj) return false;
    if (f.type && (f.type === "eoi") !== isEoiProj(c.proj)) return false;
    if (f.age) { const b = BANDS[+f.age]; if (c.age < b.lo || c.age > b.hi) return false; }
    return true;
  }), [f]);

  const inHand = scoped.reduce((s, c) => s + c.net, 0);
  const paid = scoped.reduce((s, c) => s + c.cleared, 0);
  const returned = scoped.reduce((s, c) => s + Math.abs(c.refunds) + Math.abs(Math.min(c.adj, 0)), 0);
  const avgAge = scoped.length ? scoped.reduce((s, c) => s + c.age, 0) / scoped.length : 0;
  const adv = scoped.filter(c => !isEoiProj(c.proj)), eoi = scoped.filter(c => isEoiProj(c.proj));
  const sum = (a: Cust[]) => a.reduce((s, c) => s + c.net, 0);

  // pending vs converted vs cancelled (all non-pool customers, project-filtered only)
  const base = useMemo(() => REAL.filter(c => !f.proj || String(c.proj) === f.proj), [f.proj]);
  const st = [0, 1, 2].map(s => base.filter(c => c.status === s).length);
  const holdingAll = base.filter(c => c.status === 0 && c.net > 1000).length;
  const zeroAll = st[0] - holdingAll;

  const byProj = useMemo(() => D.PROJECTS.map((_, p) => {
    const cs = scoped.filter(c => c.proj === p);
    return { p, n: cs.length, hand: sum(cs), paid: cs.reduce((s, c) => s + c.cleared, 0), age: cs.length ? cs.reduce((s, c) => s + c.age, 0) / cs.length : 0 };
  }).filter(r => r.n > 0).sort((a, b) => b.hand - a.hand), [scoped]);

  const bands = BANDS.map(b => { const cs = scoped.filter(c => c.age >= b.lo && c.age <= b.hi); return { ...b, n: cs.length, amt: sum(cs) }; });

  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach(c => { if (c.first >= 0) { const k = new Date(EPOCH + c.first * DAY).toISOString().slice(0, 7); m.set(k, (m.get(k) ?? 0) + c.net); } });
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-12).map(([k, v]) => ({
      label: new Date(k + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }), value: v,
    }));
  }, [scoped]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const a = t ? scoped.filter(c => c.code.toLowerCase().includes(t) || D.PROJECTS[c.proj].toLowerCase().includes(t)) : scoped;
    return [...a].sort((x, y) => (sort === "hand" ? y.net - x.net : y.age - x.age));
  }, [scoped, q, sort]);
  const shown = q || more ? list : list.slice(0, SHOW);

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">EOI / Advance</h1><p className="m-sub">Allotment-pending money in hand · as on {D.meta.asOn}</p></div>
      <FilterBar fields={fields} values={f} onApply={v => { setF(v); setMore(false); }} quick={["proj", "type"]} />

      <Hero label="Money in hand" value={inrCr(inHand, 2)} sub={`${fN(scoped.length)} customers awaiting allotment`}
        cells={[{ v: inrCr(paid, 1), l: "Paid in" }, { v: inrCr(returned, 1), l: "Refunded / moved" }, { v: `${Math.round(avgAge)} d`, l: "Avg ageing" }]} />

      <div className="m-grid2">
        <Kpi label="Advance (RERA)" value={inrCr(sum(adv), 1)} sub={`${fN(adv.length)} customers`} color="#0e7490" />
        <Kpi label="EOI (Code 67)" value={inrCr(sum(eoi), 1)} sub={`${fN(eoi.length)} customers · RERA awaited`} color="#8a5aa8" />
      </div>

      <Section title="Pending vs converted" />
      <Card>
        <CardHead title="Where customers stand" sub={`${fN(base.length)} customers (pooled accounts excluded)`} />
        <div style={{ margin: "12px 0 8px" }}>
          <SegBar parts={[{ v: holdingAll, c: "#eda100" }, { v: zeroAll, c: "#c9cfdd" }, { v: st[1], c: "#16a06f" }, { v: st[2], c: "#c0392b" }]} />
        </div>
        <Legend items={[
          { l: "Holding money", c: "#eda100", v: fN(holdingAll) }, { l: "Pending, ₹0", c: "#c9cfdd", v: fN(zeroAll) },
          { l: "Allotted", c: "#16a06f", v: fN(st[1]) }, { l: "Cancelled", c: "#c0392b", v: fN(st[2]) },
        ]} />
        <p className="m-sub" style={{ margin: "10px 0 0" }}>{pct(st[1], base.length)} converted to allotment. {fN(ZERO)} pending codes overall show ₹0 in hand (money adjusted to a sale order or refunded).</p>
      </Card>

      <Section title="By project" />
      {byProj.length ? byProj.map(r => (
        <Card key={r.p}>
          <CardHead title={pName(r.p)} sub={`${fN(r.n)} customers · paid ${inrCr(r.paid, 1)}`} right={<Pill tone={isEoiProj(r.p) ? "gold" : undefined}>{typeLbl(r.p)}</Pill>} />
          <div className="m-num" style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 6px" }}>{inrCr(r.hand, 2)}</div>
          <Progress pct={pctN(r.hand, inHand)} color={isEoiProj(r.p) ? "#8a5aa8" : "#0e7490"} />
          <p className="m-sub" style={{ margin: "6px 0 0" }}>{pct(r.hand, inHand)} of money held · avg {Math.round(r.age)} d</p>
        </Card>
      )) : <Empty title="Nothing in hand" sub="No customers match these filters." />}

      <Section title="Ageing" />
      <Card>
        <CardHead title="How long has the money waited?" sub="Days since first payment, still not allotted" />
        {scoped.length ? (
          <>
            <div style={{ margin: "12px 0 8px" }}><SegBar parts={bands.map(b => ({ v: b.n, c: b.c }))} /></div>
            {bands.filter(b => b.n > 0).map(b => (
              <Row key={b.k} title={b.l} sub={`${pct(b.n, scoped.length)} of customers`} value={inrCr(b.amt, 1)} valueSub={`${fN(b.n)} customers`}
                icon={<i style={{ width: 10, height: 10, borderRadius: 5, background: b.c, display: "block" }} />}
                onClick={() => { setF({ ...f, age: b.k }); setMore(false); }} />
            ))}
          </>
        ) : <Empty title="No data" />}
      </Card>
      {monthly.length > 0 && (
        <Card>
          <CardHead title="When the money came in" sub="In-hand amount by month of first payment" />
          <BarChart data={monthly} format={n => inrCr(n, 1)} />
        </Card>
      )}

      <Section title="Customers holding money" />
      <Seg value={sort} options={[{ k: "hand", l: "Largest first" }, { k: "age", l: "Oldest first" }]} onChange={setSort} />
      <SearchBar value={q} onChange={setQ} placeholder="Search customer code or project" />
      {shown.length ? (
        <List>
          {shown.map(c => (
            <Row key={c.code} title={c.code} sub={`${pName(c.proj)} · ${typeLbl(c.proj)} · ${c.age} d`} value={inrCr(c.net, 2)} valueSub="in hand" onClick={() => setOpen(c)} />
          ))}
        </List>
      ) : <Empty title="No customers" sub="Try clearing the search or filters." />}
      {!q && !more && list.length > SHOW && <button type="button" className="m-btn" onClick={() => setMore(true)}>Show all {fN(list.length)}</button>}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `Customer ${open.code}` : ""}>
        {open && <Detail c={open} />}
      </Sheet>
    </div>
  );
}

function Detail({ c }: { c: Cust }) {
  const rc = useMemo(() => D.R.filter(r => r[0] === c.idx).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 40), [c.idx]);
  return (
    <div className="m-stack">
      <div className="m-grid2">
        <Kpi label="In hand" value={inrCr(c.net, 2)} accent color="#16a06f" />
        <Kpi label="Paid (cleared)" value={inrCr(c.cleared, 2)} color="#0e7490" />
        <Kpi label="Refunded" value={inrCr(Math.abs(c.refunds), 2)} color="#c0392b" />
        <Kpi label="Adjusted out" value={inrCr(Math.abs(Math.min(c.adj, 0)), 2)} color="#96691c" />
      </div>
      <Card>
        <Row title="Project" value={pName(c.proj)} valueSub={typeLbl(c.proj)} />
        <Row title="First receipt" value={fD(c.first)} />
        <Row title="Last activity" value={fD(c.last)} />
        <Row title="Waiting for allotment" value={`${c.age} days`} />
        <Row title="Receipts" value={String(c.n)} valueSub={c.bounced ? `${inrCr(Math.abs(c.bounced), 1)} bounced (excl.)` : undefined} />
      </Card>
      <Card>
        <CardHead title="Receipts" sub={rc.length < c.n ? `Latest ${rc.length} of ${c.n}` : undefined} />
        {rc.length ? rc.map((r, i) => (
          <Row key={i} title={fD(r[1] as number)} sub={`${D.MODE[r[4] as number]} · ${D.RS[r[3] as number]}`} value={inrCr(r[2] as number, 2)} />
        )) : <Empty title="No receipts" />}
      </Card>
    </div>
  );
}
