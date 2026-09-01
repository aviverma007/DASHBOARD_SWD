import { useMemo, useState } from "react";
import { showTip, hideTip } from "../common/hoverTip";
import { fNum, isoToDay, dayToDate, periodPresets, type PeriodPreset } from "../../utils/footfallLogic";
import {
  CPV, CPV_RECORDS, cpvApply, cpvMonthly, cpvWeekday, cpvFirstVisitMap,
  type CpvDim, type CpvChip, type CpvRec,
} from "../../utils/cpVisitsLogic";
import {
  HBarList, Donut, TrendChart, WeekdayChart, Banner, Spark,
  CARD, H3, CAP, SEL, SELLBL, BLUE, TEAL, GOLD, GREEN, PAL,
} from "./footfallCharts";
import { CpVisitsDrillDrawer, type CpvDrillSeed } from "./CpVisitsDrillDrawer";

const ROW: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "start" };

/** Channel-partner visits — now driven by the dedicated 31-Aug CP
 * visit export (48,397 partner gallery visits, 5,421 partners), NOT
 * derived from customer footfall. Booking data intentionally absent:
 * this file tracks partner engagement. */
export function CpVisitsSection() {
  const [projFilter, setProjFilter] = useState<CpvChip | null>(null);
  const PRESETS = useMemo(() => periodPresets(), []);
  const [perKey, setPerKey] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const per: PeriodPreset = useMemo(() => {
    if (perKey === "custom") {
      const from = customFrom ? isoToDay(customFrom) : -1;
      const to = customTo ? isoToDay(customTo) : 1e9;
      const lbl = customFrom || customTo ? `Custom (${customFrom || "…"} → ${customTo || "…"})` : "Custom range";
      return { key: "custom", label: lbl, from, to };
    }
    return PRESETS.find(p => p.key === perKey) ?? PRESETS[0];
  }, [perKey, customFrom, customTo, PRESETS]);
  const [drill, setDrill] = useState<CpvDrillSeed | null>(null);
  const openDrill = (dim: CpvDim) => (val: number | string, label: string) => setDrill({ dim, val, label });

  const FIRST = useMemo(() => cpvFirstVisitMap(), []);
  const dimRows = useMemo(() => cpvApply(CPV_RECORDS, projFilter ? [projFilter] : []), [projFilter]);
  const rows = useMemo(
    () => (per.key === "all" ? dimRows : dimRows.filter(r => r.day >= per.from && r.day <= per.to)),
    [dimRows, per]
  );
  const total = rows.length;

  // KPIs
  const uniq = useMemo(() => new Set(rows.filter(r => r.cp >= 0).map(r => r.cp)), [rows]);
  const newPartners = useMemo(() => {
    let n = 0;
    uniq.forEach(cp => {
      const fd = FIRST.get(cp);
      if (fd === undefined) return;
      if (per.key === "all" ? true : fd >= per.from && fd <= per.to) n++;
    });
    return n;
  }, [uniq, FIRST, per]);
  const revisits = useMemo(
    () => rows.filter(r => r.cp >= 0 && r.day >= 0 && r.day > (FIRST.get(r.cp) ?? Infinity)).length,
    [rows, FIRST]
  );
  const firstTimers = total - revisits;
  const visitors = useMemo(() => rows.filter(r => r.nv > 0).reduce((a, r) => a + r.nv, 0), [rows]);
  const monthly = useMemo(() => cpvMonthly(rows), [rows]);
  const weekday = useMemo(() => cpvWeekday(rows), [rows]);

  // Active partners per month
  const activeMonthly = useMemo(() => {
    const m = new Map<string, Set<number>>();
    rows.forEach(r => {
      if (r.day < 0 || r.cp < 0) return;
      const dd = dayToDate(r.day);
      const ym = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
      if (!m.has(ym)) m.set(ym, new Set());
      m.get(ym)!.add(r.cp);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, s]) => {
        const [y, mo] = key.split("-");
        return { key, label: `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(mo) - 1]}'${y.slice(2)}`, value: s.size };
      });
  }, [rows]);

  const listFrom = (get: (r: CpvRec) => number, names: string[], top = 10) => {
    const m = new Map<number, number>();
    rows.forEach(r => { const k = get(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);
  };

  const KPI = ({ l, v, s, spark }: { l: string; v: string; s?: string; spark?: boolean }) => (
    <div className="card" style={{ ...CARD, padding: "13px 16px" }}
      onMouseEnter={e => showTip(e, `<b>${l}</b><br/>${v}${s ? ` · ${s}` : ""}`)}
      onMouseMove={e => showTip(e, `<b>${l}</b><br/>${v}${s ? ` · ${s}` : ""}`)}
      onMouseLeave={hideTip}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{l}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      {s && <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1 }}>{s}</div>}
      {spark && <Spark items={monthly.slice(-18)} />}
    </div>
  );

  // ── Partner board ──
  const [q, setQ] = useState("");
  const [boardPage, setBoardPage] = useState(1);
  const board = useMemo(() => {
    const m = new Map<number, { cp: number; name: string; visits: number; projects: Set<number>; galleries: Set<number>; last: number }>();
    rows.forEach(r => {
      if (r.cp < 0) return;
      if (!m.has(r.cp)) m.set(r.cp, { cp: r.cp, name: CPV.CPN[r.cp], visits: 0, projects: new Set(), galleries: new Set(), last: -1 });
      const e = m.get(r.cp)!;
      e.visits++;
      if (r.p >= 0) e.projects.add(r.p);
      if (r.g >= 0) e.galleries.add(r.g);
      if (r.day > e.last) e.last = r.day;
    });
    let list = [...m.values()].sort((a, b) => b.visits - a.visits);
    if (q.trim()) list = list.filter(p => p.name.toLowerCase().includes(q.trim().toLowerCase()));
    return list;
  }, [rows, q]);
  const BPER = 10;
  const bpages = Math.max(1, Math.ceil(board.length / BPER));
  const bshown = board.slice((boardPage - 1) * BPER, boardPage * BPER);
  const fdate = (day: number) => day >= 0 ? dayToDate(day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

  return (
    <div>
      <CpVisitsDrillDrawer
        seed={drill}
        baseRows={rows}
        baseLabel={`${projFilter ? projFilter.label + " · " : ""}${per.label}`}
        onClose={() => setDrill(null)}
      />

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={SELLBL}>Project</div>
          <select
            style={SEL}
            value={projFilter ? String(projFilter.val) : "all"}
            onChange={e => {
              const v = e.target.value;
              setProjFilter(v === "all" ? null : { dim: "p", val: Number(v), label: CPV.PRJ[Number(v)] });
            }}
          >
            <option value="all">All projects</option>
            {CPV.PRJ.map((p, i) => <option key={p} value={i}>{p}</option>)}
          </select>
        </div>
        <div>
          <div style={SELLBL}>Period</div>
          <select style={SEL} value={perKey} onChange={e => setPerKey(e.target.value)}>
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            <option value="custom">Custom range…</option>
          </select>
        </div>
        {per.key === "custom" && (
          <>
            <div>
              <div style={SELLBL}>From</div>
              <input type="date" min="2022-01-01" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...SEL, minWidth: 140 }} />
            </div>
            <div>
              <div style={SELLBL}>To</div>
              <input type="date" min="2022-01-01" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...SEL, minWidth: 140 }} />
            </div>
          </>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 4 }}>
        <KPI l="CP gallery visits" v={fNum(total)} s={per.label} spark />
        <KPI l="Unique partners" v={fNum(uniq.size)} s="visited" />
        <KPI l="New partners" v={fNum(newPartners)} s="first-ever visit" />
        <KPI l="Revisits" v={fNum(revisits)} s={`${((revisits / Math.max(total, 1)) * 100).toFixed(1)}%`} />
        <KPI l="Avg visits / CP" v={uniq.size ? (total / uniq.size).toFixed(1) : "0"} />
        <KPI l="Recorded visitors" v={fNum(visitors)} s="where group size given" />
      </div>

      <div><Banner title="CHANNEL PARTNER ENGAGEMENT" sub={`${fNum(total)} partner visits · ${per.label} · dedicated CP export`} /></div>

      {/* Row 1: gallery + project — same size, project scrolls */}
      <div style={ROW}>
        <div style={CARD}>
          <h3 style={H3}>CP visits by gallery</h3>
          <div style={CAP}>click → gallery breakdown</div>
          <HBarList items={listFrom(r => r.g, CPV.G)} total={total} color={BLUE} onPick={openDrill("g")} />
        </div>
        <div style={CARD}>
          <h3 style={H3}>CP visits by project</h3>
          <div style={CAP}>top 10 of {CPV.PRJ.length} · click → project breakdown</div>
          <HBarList items={listFrom(r => r.p, CPV.PRJ)} total={total} color={GOLD} onPick={openDrill("p")} maxHeight={196} />
        </div>
      </div>

      {/* Row 2: donut trio — visit-vs-revisit, status, type */}
      <div style={{ ...ROW, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", alignItems: "stretch" }}>
        <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
          <h3 style={H3}>Visit vs revisit</h3>
          <div style={CAP}>revisit = the partner had visited before that day</div>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <Donut
              segs={[
                { key: 0, label: "Revisit", value: revisits, color: TEAL },
                { key: 1, label: "First visit", value: firstTimers, color: GOLD },
              ].filter(s => s.value > 0)}
            />
          </div>
        </div>
        <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
          <h3 style={H3}>Visit status</h3>
          <div style={CAP}>click a slice</div>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <Donut
              segs={listFrom(r => r.sta, CPV.STA, 6).map(s => ({
                ...s,
                color: s.label === "Completed" ? GREEN : s.label === "Scheduled" ? GOLD : s.label === "In Progress" ? TEAL : PAL[3],
              }))}
              onPick={openDrill("sta")}
            />
          </div>
        </div>
        <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
          <h3 style={H3}>Visit type</h3>
          <div style={CAP}>{fNum(rows.filter(r => r.vt >= 0).length)} of {fNum(total)} specified</div>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <Donut
              segs={listFrom(r => r.vt, CPV.VT, 4).map((s, i) => ({ ...s, color: [TEAL, GOLD, BLUE][i % 3] }))}
              onPick={openDrill("vt")}
            />
          </div>
        </div>
      </div>

      {/* Row 3: assigned RM + group size */}
      <div style={ROW}>
        <div style={CARD}>
          <h3 style={H3}>Assigned RM leaderboard</h3>
          <div style={CAP}>visits handled · click → RM breakdown</div>
          <HBarList items={listFrom(r => r.asg, CPV.ASG)} total={total} color="#7b5cb8" onPick={openDrill("asg")} maxHeight={230} />
        </div>
        <div style={CARD}>
          <h3 style={H3}>Visitor group size</h3>
          <div style={CAP}>partners bringing groups · where recorded</div>
          <HBarList
            items={(() => {
              const b: Record<string, number> = { "1 visitor": 0, "2": 0, "3": 0, "4": 0, "5+": 0 };
              rows.forEach(r => {
                if (r.nv <= 0) return;
                if (r.nv === 1) b["1 visitor"]++;
                else if (r.nv === 2) b["2"]++;
                else if (r.nv === 3) b["3"]++;
                else if (r.nv === 4) b["4"]++;
                else b["5+"]++;
              });
              return Object.entries(b).map(([label, value], i) => ({ key: i, label, value }));
            })()}
            total={rows.filter(r => r.nv > 0).length}
            color={GREEN}
          />
        </div>
      </div>

      {/* Row 4: trends */}
      <div style={ROW}>
        <div style={CARD}>
          <h3 style={H3}>CP visits trend</h3>
          <div style={CAP}>monthly gallery visits · click a month</div>
          <TrendChart items={monthly} onPick={openDrill("mon")} />
        </div>
        <div style={CARD}>
          <h3 style={H3}>Active partners / month</h3>
          <div style={CAP}>distinct partners who visited that month</div>
          <TrendChart items={activeMonthly} />
        </div>
      </div>
      <div style={ROW}>
        <div style={CARD}>
          <h3 style={H3}>Weekday pattern</h3>
          <div style={CAP}>visits by day of week · click a day</div>
          <WeekdayChart items={weekday} onPick={openDrill("dow")} />
        </div>
      </div>

      {/* Partner board */}
      <div>
        <Banner title="CHANNEL-PARTNER PERFORMANCE" sub={`${fNum(board.length)} partners · click a partner to drill`} />
      </div>
      <div style={{ ...CARD, paddingBottom: 6 }}>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setBoardPage(1); }}
          placeholder="Search channel partner…"
          style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 13.5, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #cfd6e2", marginBottom: 10 }}
        />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                {["Channel partner", "CP visits", "Share", "Projects", "Galleries", "Last visit"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: i === 0 ? "7px 8px 7px 0" : "7px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bshown.map(p => (
                <tr key={p.cp}
                  onClick={() => openDrill("cp")(p.cp, p.name)}
                  onMouseEnter={e => showTip(e, `<b>${p.name}</b><br/>${fNum(p.visits)} visits · ${((p.visits / Math.max(total, 1)) * 100).toFixed(1)}% share<br/>${p.projects.size} projects · ${p.galleries.size} galleries · last ${fdate(p.last)}`)}
                  onMouseMove={e => showTip(e, `<b>${p.name}</b><br/>${fNum(p.visits)} visits · ${((p.visits / Math.max(total, 1)) * 100).toFixed(1)}% share<br/>${p.projects.size} projects · ${p.galleries.size} galleries · last ${fdate(p.last)}`)}
                  onMouseLeave={hideTip}
                  style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                  <td style={{ padding: "7px 8px 7px 0", fontWeight: 600, color: "var(--ink)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "Georgia,serif", fontWeight: 700 }}>{fNum(p.visits)}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--mut)" }}>{((p.visits / Math.max(total, 1)) * 100).toFixed(1)}%</td>
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>{p.projects.size}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>{p.galleries.size}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", whiteSpace: "nowrap" }}>{fdate(p.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 6px", fontSize: 12.5, color: "var(--mut)" }}>
          <span>{board.length ? `${(boardPage - 1) * BPER + 1}—${Math.min(boardPage * BPER, board.length)} of ${fNum(board.length)}` : "No partners"}</span>
          <button disabled={boardPage <= 1} onClick={() => setBoardPage(p => p - 1)} style={{ marginLeft: "auto", border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: boardPage <= 1 ? "default" : "pointer", opacity: boardPage <= 1 ? 0.45 : 1, fontFamily: "inherit" }}>‹ Prev</button>
          <button disabled={boardPage >= bpages} onClick={() => setBoardPage(p => p + 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: boardPage >= bpages ? "default" : "pointer", opacity: boardPage >= bpages ? 0.45 : 1, fontFamily: "inherit" }}>Next ›</button>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 12 }}>
        Source: {CPV.meta.source} ({fNum(CPV.meta.rows)} rows, as on {CPV.meta.asOn}) · a row = one channel-partner rep visiting a
        sales gallery · new partner = first-ever visit falls inside the selected period · revisit = the partner already had an
        earlier visit · {CPV.meta.note}.
      </div>
    </div>
  );
}
