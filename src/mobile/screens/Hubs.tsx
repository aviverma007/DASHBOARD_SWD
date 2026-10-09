import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { ANALYTICS, PROJECT_MODS, visible, type Mod } from "../nav";
import { Ico, Section, Card, Progress, SearchBar, Empty, Pill, Row, List } from "../ui";
import { collectionTotals, overall } from "../data";
import { fN, inrCr, pct, pctN, shortName } from "../fmt";

const TONE: Record<string, string> = { n: "", g: "g", t: "t", o: "o" };

function ModCard({ m, metric, onOpen }: { m: Mod; metric?: string; onOpen: () => void }) {
  return (
    <button type="button" className="m-card tap" onClick={onOpen} style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start", textAlign: "left", minWidth: 0 }}>
      <span className="m-tile" style={{ padding: 0 }}><span className={`ic ${TONE[m.tone ?? "n"]}`} style={{ width: 42, height: 42, borderRadius: 13 }}><Ico n={m.icon} size={20} /></span></span>
      <span style={{ minWidth: 0, width: "100%" }}>
        <b style={{ display: "block", fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>{m.label}</b>
        <small style={{ display: "block", fontSize: 11.5, color: "var(--m-mut)", marginTop: 2 }}>{metric ?? m.blurb}</small>
      </span>
    </button>
  );
}

export function AnalyticsHub() {
  const nav = useNavigate();
  const access = useAuthStore(s => s.access);
  const ov = useMemo(overall, []);
  const coll = useMemo(collectionTotals, []);
  const metric: Record<string, string> = {
    "/bookings": `${fN(ov.sold.units)} units · ${inrCr(ov.sold.tsv, 0)}`,
    "/sap-collections": `${pct(coll.recv, coll.called)} collected`,
  };
  const groups = ANALYTICS.map(g => ({ ...g, items: visible(g.items, access) })).filter(g => g.items.length);
  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Analytics</h1><p className="m-sub">Pick a module to dive in</p></div>
      {groups.map(g => (
        <div key={g.title} className="m-stack">
          <Section title={g.title} />
          <div className="m-grid2">
            {g.items.map(m => <ModCard key={m.path} m={m} metric={metric[m.path]} onOpen={() => nav(m.path)} />)}
          </div>
        </div>
      ))}
      {!groups.length && <Empty title="No modules assigned" sub="Ask the admin to enable access for your login." />}
    </div>
  );
}

export function ProjectsHub() {
  const nav = useNavigate();
  const access = useAuthStore(s => s.access);
  const [q, setQ] = useState("");
  const ov = useMemo(overall, []);
  const list = ov.projects.filter(p => p.projectName.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.sold.tsv - a.sold.tsv);
  const mods = visible(PROJECT_MODS, access);
  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Projects</h1><p className="m-sub">{ov.projects.length} projects · {fN(ov.total.units)} units</p></div>
      <SearchBar value={q} onChange={setQ} placeholder="Search projects" />
      {list.map(p => (
        <Card key={p.projectName} onClick={mods.some(m => m.path === "/inventory") ? () => nav("/inventory") : undefined}>
          <div className="m-proj-t" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <b style={{ fontSize: 14.5, fontWeight: 800 }}>{shortName(p.projectName)}</b>
              <Pill tone={p.soldPct >= 80 ? "ok" : p.soldPct >= 50 ? "gold" : "warn"}>{p.soldPct}% sold</Pill>
            </div>
            <Progress pct={pctN(p.sold.units, p.total.units)} lg />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--m-mut)" }}>
              <span>{fN(p.sold.units)} sold · {fN(p.unsold.units)} available</span><b className="m-num" style={{ color: "var(--m-ink)" }}>{inrCr(p.sold.tsv, 0)}</b>
            </div>
          </div>
        </Card>
      ))}
      {!list.length && <Empty title="No projects found" sub="Try a different search." />}
      {mods.length > 0 && <><Section title="Project tools" /><List>{mods.map(m => <Row key={m.path} icon={<Ico n={m.icon} size={18} />} title={m.label} sub={m.blurb} onClick={() => nav(m.path)} />)}</List></>}
    </div>
  );
}
