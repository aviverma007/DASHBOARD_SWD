import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardHead, Chip, Chips, Empty, FullViewLink, Hero, HBars, Kpi, Legend, List, Pill, Progress, Row, Section, SearchBar, SegBar, Seg, Sheet } from "../ui";
import { CB, WBS_ROWS, PO_ROWS, STATUS_LBL, statusOf, fMoney, fN, fmtDay, projLbl, type WbsRow } from "../../components/cost/costShared";
import { inrCr, pct, pctN } from "../fmt";

type St = keyof typeof STATUS_LBL;
const ST_COL: Record<St, string> = { healthy: "#16a06f", watch: "#e6a100", critical: "#d64545", nobudget: "#8d99ae" };
const ST_SHORT: Record<St, string> = { healthy: "Healthy", watch: "Watch", critical: "Critical", nobudget: "No budget" };
const ORDER: St[] = ["healthy", "watch", "critical", "nobudget"];
type Typ = "all" | "1" | "0";
const upct = (w: WbsRow) => (w.budget > 0 ? (w.assigned / w.budget) * 100 : w.assigned > 0 ? 999 : 0);

export default function Cost() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [typ, setTyp] = useState<Typ>("all");
  const [st, setSt] = useState<St | "">("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<WbsRow | null>(null);
  const [lim, setLim] = useState(25);

  const scope = useMemo(() => WBS_ROWS.filter(w => typ === "all" || w.typ === Number(typ)), [typ]);
  const sum = useMemo(() => {
    const s = { budget: 0, assigned: 0, actual: 0, commitment: 0, available: 0 };
    scope.forEach(w => { s.budget += w.budget; s.assigned += w.assigned; s.actual += w.actual; s.commitment += w.commitment; s.available += w.available; });
    return s;
  }, [scope]);
  const health = useMemo(() => {
    const m: Record<St, number> = { healthy: 0, watch: 0, critical: 0, nobudget: 0 };
    scope.forEach(w => { m[statusOf(w)]++; });
    return m;
  }, [scope]);
  const util = pctN(sum.assigned, sum.budget);

  const byDept = useMemo(() => {
    const m = new Map<number, { b: number; a: number }>();
    scope.forEach(w => { const e = m.get(w.dept) ?? { b: 0, a: 0 }; e.b += w.budget; e.a += w.assigned; m.set(w.dept, e); });
    return [...m.entries()].sort((x, y) => y[1].a - x[1].a).slice(0, 8);
  }, [scope]);
  const byProj = useMemo(() => {
    const m = new Map<string, { b: number; a: number }>();
    scope.forEach(w => { const e = m.get(w.proj) ?? { b: 0, a: 0 }; e.b += w.budget; e.a += w.assigned; m.set(w.proj, e); });
    return [...m.entries()].sort((x, y) => y[1].a - x[1].a).slice(0, 8);
  }, [scope]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return scope
      .filter(w => (!st || statusOf(w) === st) && (!t || w.wbs.toLowerCase().includes(t) || w.desc.toLowerCase().includes(t)))
      .sort((a, b) => upct(b) - upct(a) || b.assigned - a.assigned);
  }, [scope, st, q]);

  const pos = useMemo(() => (sel ? PO_ROWS.filter(p => p.w === sel.i).sort((a, b) => b.ordered - a.ordered) : []), [sel]);
  const selSt = sel ? statusOf(sel) : "healthy";

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Cost &amp; Budget</h1><p className="m-sub">{fN(scope.length)} WBS elements · as on {CB.meta.asOn}</p></div>

      <Seg<Typ> value={typ} onChange={v => { setTyp(v); setSt(""); setLim(25); }} options={[{ k: "all", l: "All" }, { k: "1", l: "Project" }, { k: "0", l: "Non-project" }]} />

      {scope.length === 0 ? <Empty title="No budget data" /> : <>
        <Hero label="Budget utilised" value={`${util.toFixed(1)}%`} sub={`${inrCr(sum.assigned)} of ${inrCr(sum.budget)} approved budget`}
          cells={[{ v: inrCr(sum.actual), l: "Actual" }, { v: inrCr(sum.commitment), l: "Committed" }, { v: inrCr(sum.available), l: "Available" }]}>
          <div style={{ marginTop: 12 }}><SegBar parts={[{ v: Math.max(sum.actual, 0), c: "#d6ac5e" }, { v: Math.max(sum.commitment, 0), c: "#7aa2ff" }, { v: Math.max(sum.available, 0), c: "rgba(255,255,255,.25)" }]} /></div>
        </Hero>

        <div className="m-grid2">
          <Kpi label="Approved budget" value={inrCr(sum.budget)} sub={`${fN(scope.length)} WBS`} color="#1e3163" accent />
          <Kpi label="Utilised" value={inrCr(sum.assigned)} sub="Actual + commitment" color="#0e7490" accent />
          <Kpi label="Actual" value={inrCr(sum.actual)} sub={`${pct(sum.actual, sum.assigned)} of utilised`} color="#6d4aa6" />
          <Kpi label="Commitment" value={inrCr(sum.commitment)} sub={`${pct(sum.commitment, sum.assigned)} of utilised`} color="#e6a100" />
        </div>

        <Card>
          <CardHead title="Budget health" sub="Tap a status to filter the WBS list" />
          <div style={{ margin: "12px 0 10px" }}><SegBar parts={ORDER.map(k => ({ v: health[k], c: ST_COL[k] }))} /></div>
          <Legend items={ORDER.map(k => ({ l: ST_SHORT[k], c: ST_COL[k], v: fN(health[k]) }))} />
          <div style={{ marginTop: 10 }}>
            <Chips>
              <Chip on={!st} onClick={() => { setSt(""); setLim(25); }}>All</Chip>
              {ORDER.map(k => <Chip key={k} on={st === k} onClick={() => { setSt(k); setLim(25); }}>{ST_SHORT[k]} · {fN(health[k])}</Chip>)}
            </Chips>
          </div>
        </Card>

        <Section title="Utilised by department" />
        <Card>
          <HBars format={v => inrCr(v)} color="#0e7490"
            rows={byDept.map(([d, e]) => ({ label: CB.DEPT[d] || "—", value: e.a, sub: `${pct(e.a, e.b)} of ${inrCr(e.b)} budget` }))} />
        </Card>

        {typ !== "0" && <>
          <Section title="Utilised by project" />
          <Card>
            <HBars format={v => inrCr(v)} color="#1e3163"
              rows={byProj.map(([p, e]) => ({ label: projLbl(p), value: e.a, sub: `${pct(e.a, e.b)} of ${inrCr(e.b)} budget` }))} />
          </Card>
        </>}

        <Section title="WBS utilisation" />
        <SearchBar value={q} onChange={v => { setQ(v); setLim(25); }} placeholder="Search WBS or description" />
        {list.length === 0 ? <Empty title="No WBS found" sub="Change the status or search." /> : <>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {list.slice(0, lim).map(w => {
                const s = statusOf(w), p = upct(w);
                return (
                  <button key={w.i} type="button" onClick={() => setSel(w)} style={{ all: "unset", cursor: "pointer", display: "block", padding: "8px 0", minHeight: 44, boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5, fontWeight: 700 }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.desc || w.wbs}</span>
                      <span className="m-num" style={{ color: ST_COL[s] }}>{w.budget > 0 ? `${p.toFixed(0)}%` : "—"}</span>
                    </div>
                    <div style={{ margin: "6px 0 3px" }}><Progress pct={Math.min(p, 100)} color={ST_COL[s]} /></div>
                    <div style={{ fontSize: 12, color: "var(--m-mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.wbs} · {fMoney(w.assigned)} of {fMoney(w.budget)}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
          {list.length > lim && <button type="button" className="m-btn" onClick={() => setLim(l => l + 25)}>Show more ({fN(list.length - lim)} left)</button>}
        </>}
      </>}

      <p className="m-sub">Vendor ageing and the non-project PO analysis are available in the full view.</p>
      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.desc || sel?.wbs || "WBS"}>
        {sel && <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <Pill tone={selSt === "healthy" ? "ok" : selSt === "critical" ? "bad" : selSt === "watch" ? "warn" : undefined}>{STATUS_LBL[selSt]}</Pill>
            <span className="m-sub" style={{ margin: 0 }}>{sel.typ === 1 ? "Project" : "Non-project"} · {CB.DEPT[sel.dept] || "—"}</span>
          </div>
          <p className="m-sub" style={{ margin: "0 0 12px", wordBreak: "break-all" }}>{sel.wbs}</p>
          <Progress pct={Math.min(upct(sel), 100)} color={ST_COL[selSt]} lg />
          <div className="m-grid2" style={{ margin: "12px 0" }}>
            <Kpi label="Budget" value={fMoney(sel.budget)} color="#1e3163" />
            <Kpi label="Utilised" value={fMoney(sel.assigned)} sub={sel.budget > 0 ? `${upct(sel).toFixed(1)}%` : "No budget"} color={ST_COL[selSt]} />
            <Kpi label="Actual" value={fMoney(sel.actual)} color="#6d4aa6" />
            <Kpi label="Commitment" value={fMoney(sel.commitment)} color="#e6a100" />
          </div>
          <Kpi label="Available" value={fMoney(sel.available)} color="#16a06f" />
          <div style={{ marginTop: 14 }}>
            <Section title={`Purchase orders · ${fN(pos.length)}`} />
            {pos.length === 0 ? <Empty title="No PO lines" sub="No purchase orders linked to this WBS." /> : (
              <List>
                {pos.slice(0, 30).map((p, i) => (
                  <Row key={p.docNo + i} title={CB.VEND[p.vendor] || "Vendor"} sub={`PO ${p.docNo} · ${fmtDay(p.day)}${p.text ? " · " + p.text : ""}`}
                    value={fMoney(p.ordered)} valueSub={`delivered ${fMoney(p.delivered)}`} />
                ))}
              </List>
            )}
            {pos.length > 30 && <p className="m-sub" style={{ textAlign: "center", marginTop: 8 }}>Showing top 30 of {fN(pos.length)} by ordered value.</p>}
          </div>
        </>}
      </Sheet>
    </div>
  );
}
