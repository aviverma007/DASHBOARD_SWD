import { useMemo, useState } from "react";
import { showTip, hideTip } from "../common/hoverTip";
import {
  FF, ffScope, ffCount, ffMonthly, ffWeekday, fNum, dayToDate, isoToDay,
  periodPresets, type PeriodPreset,
  type FfFilter, type FfDim, type FfRecord,
} from "../../utils/footfallLogic";
import {
  HBarList, Donut, TrendChart, WeekdayChart, FunnelChart, Banner, Spark,
  MomentumCard, CpBoard, CARD, H3, CAP, SEL, SELLBL, PAL, BLUE, TEAL, GOLD, GREEN, RED,
} from "./footfallCharts";
import { FootfallDrillDrawer, type DrillSeed } from "./FootfallDrillDrawer";
import { VisitRecordPanel } from "./VisitRecordPanel";

/** Customer-footfall analysis, modelled on the reference suite's
 * footfall tab and rebuilt over the 21-Aug export (54,222 visits):
 * KPI strip · click-to-filter cards (gallery, source donut, project,
 * locality, age donut, monthly trend, weekday) · a conversion FUNNEL
 * from Opportunity Stage (our addition) · paginated records table.
 * Clicking any bar/slice/month/weekday narrows every card at once;
 * active filters show as removable chips. */

// ── Main section ──────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export function FootfallSection() {
  const [filters, setFilters] = useState<FfFilter[]>([]);
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);
  const PRESETS = useMemo(() => periodPresets(), []);
  const [perKey, setPerKey] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const per: PeriodPreset = useMemo(() => {
    if (perKey === "custom") {
      const from = customFrom ? isoToDay(customFrom) : -1;
      const to = customTo ? isoToDay(customTo) : 1e9;
      const lbl = customFrom || customTo
        ? `Custom (${customFrom || "…"} → ${customTo || "…"})`
        : "Custom range";
      return { key: "custom", label: lbl, from, to };
    }
    return PRESETS.find(p => p.key === perKey) ?? PRESETS[0];
  }, [perKey, customFrom, customTo, PRESETS]);

  // Dimension filters first, then the global period window
  const [selProjects, setSelProjects] = useState<number[]>([]);
  const [projOpen, setProjOpen] = useState(false);
  const dimRows = useMemo(() => ffScope(filters), [filters]);
  const rows = useMemo(() => {
    let out = per.key === "all" ? dimRows : dimRows.filter(r => r.day >= per.from && r.day <= per.to);
    if (selProjects.length > 0) {
      const set = new Set(selProjects);
      out = out.filter(r => set.has(r.p));
    }
    return out;
  }, [dimRows, per, selProjects]);
  const total = rows.length;

  function removeFilter(dim: FfDim) {
    setFilters(prev => prev.filter(f => f.dim !== dim));
    setPage(1);
  }
  const has = (dim: FfDim) => filters.some(f => f.dim === dim);

  // KPI computations (mirroring the reference)
  const direct = rows.filter(r => r.src === 0 || r.src === 2).length;
  const withCp = rows.filter(r => r.src === 1).length;
  const uProj = new Set(rows.filter(r => r.p >= 0).map(r => r.p)).size;
  const activeDays = new Set(rows.filter(r => r.day >= 0).map(r => r.day)).size;
  const perDay = activeDays ? total / activeDays : 0;
  const bookedPct = total ? (rows.filter(r => FF.STG[r.stg] === "Booked").length / total) * 100 : 0;

  const monthly = useMemo(() => ffMonthly(rows), [rows]);
  const weekday = useMemo(() => ffWeekday(rows), [rows]);

  const listFrom = (map: Map<number, number>, names: string[], top = 99999) =>
    [...map.entries()].filter(([k]) => k >= 0).map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => sortDir * (a.day - b.day)),
    [rows, sortDir]
  );
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const shown = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const KPI = ({ l, v, s }: { l: string; v: string; s?: string }) => (
    <div className="card" style={{ ...CARD, padding: "13px 16px" }}
      onMouseEnter={e => showTip(e, `<b>${l}</b><br/>${v}${s ? ` · ${s}` : ""}`)}
      onMouseMove={e => showTip(e, `<b>${l}</b><br/>${v}${s ? ` · ${s}` : ""}`)}
      onMouseLeave={hideTip}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{l}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      {s && <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1 }}>{s}</div>}
    </div>
  );

  const [drill, setDrill] = useState<DrillSeed | null>(null);
  const [recDetail, setRecDetail] = useState<FfRecord | null>(null);
  const openDrill = (dim: FfDim) => (val: number | string, label: string) => setDrill({ dim, val, label });

  return (
    <div>
      <VisitRecordPanel rec={recDetail} onClose={() => setRecDetail(null)} />
      <FootfallDrillDrawer
        seed={drill}
        baseRows={rows}
        baseLabel={`${selProjects.length ? (selProjects.length === 1 ? FF.P[selProjects[0]] : selProjects.length + " projects") + " · " : ""}${per.label}`}
        onClose={() => setDrill(null)}
      />
      {/* Global filter bar — project + period, reference-style */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ position: "relative" }}>
          <div style={SELLBL}>Projects / campaigns</div>
          <button onClick={() => setProjOpen(v => !v)}
            style={{ ...SEL, minWidth: 220, textAlign: "left", cursor: "pointer" }}>
            {selProjects.length === 0 ? "All projects" : selProjects.length === 1 ? FF.P[selProjects[0]] : `${selProjects.length} projects selected`} ▾
          </button>
          {projOpen && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 40, marginTop: 4, background: "#fff", border: "1.5px solid #cfd6e2", borderRadius: 10, boxShadow: "0 12px 34px rgba(20,33,61,.18)", padding: "8px 10px", maxHeight: 300, overflowY: "auto", minWidth: 280 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0", cursor: "pointer", fontWeight: 700 }}>
                <input type="checkbox" checked={selProjects.length === 0}
                  onChange={() => setSelProjects([])} style={{ accentColor: "#0e7490" }} />
                All projects
              </label>
              {FF.P.map((p, i) => (
                <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={selProjects.includes(i)}
                    onChange={() => setSelProjects(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                    style={{ accentColor: "#0e7490" }} />
                  {p}
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={SELLBL}>Period</div>
          <select style={SEL} value={perKey} onChange={e => { setPerKey(e.target.value); setPage(1); }}>
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            <option value="custom">Custom range…</option>
          </select>
        </div>
        {per.key === "custom" && (
          <>
            <div>
              <div style={SELLBL}>From</div>
              <input type="date" min="2022-01-01" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ ...SEL, minWidth: 140 }} />
            </div>
            <div>
              <div style={SELLBL}>To</div>
              <input type="date" min="2022-01-01" value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{ ...SEL, minWidth: 140 }} />
            </div>
          </>
        )}
      </div>

      {/* Momentum & comparison (own periods; respects dimension filters) */}
      <MomentumCard records={dimRows} />

      {/* Active filter chips */}
      {filters.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, color: "var(--mut)" }}>Filtered by:</span>
          {filters.map(f => (
            <button key={f.dim} onClick={() => removeFilter(f.dim)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#1E3163", color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
              {f.label} <span style={{ opacity: 0.7 }}>✕</span>
            </button>
          ))}
          <button onClick={() => { setFilters([]); setPage(1); }}
            style={{ background: "none", border: "none", color: "#c07a1a", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Clear all
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div className="card" style={{ ...CARD, padding: "13px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>Footfall</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{fNum(total)}</div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1 }}>{per.label} · till {FF.meta.asOn}</div>
          <Spark items={monthly.slice(-18)} />
        </div>
        <KPI l="Direct" v={fNum(direct)} s={`${((direct / Math.max(total, 1)) * 100).toFixed(1)}% of visits`} />
        <KPI l="With CP" v={fNum(withCp)} s={`${((withCp / Math.max(total, 1)) * 100).toFixed(1)}% of visits`} />
        <KPI l="Projects visited" v={fNum(uProj)} s="unique projects/campaigns" />
        <KPI l="Avg / active day" v={perDay.toFixed(0)} s={`${fNum(activeDays)} active days`} />
        <KPI l="Booking conversion" v={bookedPct.toFixed(1) + "%"} s="of footfall booked" />
      </div>

      <div><Banner title="FOOTFALL ANALYSIS" sub={`${fNum(total)} customer visits · ${per.label}`} /></div>

      {/* Funnel — our addition on top of the reference layout */}
      <div style={{ ...CARD, marginBottom: 14 }}>
        <h3 style={H3}>Conversion funnel</h3>
        <div style={CAP}>Footfall → pipeline → progressed → booked · recomputes with every filter</div>
        <FunnelChart records={rows} />
      </div>

      {/* Row 1: gallery + project — same size, project scrolls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        {!has("g") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall by gallery</h3>
            <div style={CAP}>click → gallery</div>
            <HBarList items={listFrom(ffCount(rows, r => r.g), FF.G)} total={total} color={BLUE} onPick={(k, l) => openDrill("g")(k, l)} />
          </div>
        )}
        {!has("p") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall by project</h3>
            <div style={CAP}>all projects · click → project</div>
            <HBarList items={listFrom(ffCount(rows, r => r.p), FF.P)} total={total} color={GOLD} onPick={(k, l) => openDrill("p")(k, l)} maxHeight={196} sortable />
          </div>
        )}
      </div>
      {/* Row 2: locality (scrolls, full width) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        {!has("loc") && (
          <div style={CARD}>
            <h3 style={H3}>Customer locality</h3>
            <div style={CAP}>all localities · click → locality</div>
            <HBarList items={listFrom(ffCount(rows, r => r.loc), FF.LOC)} total={total} color={TEAL} onPick={(k, l) => openDrill("loc")(k, l)} maxHeight={230} sortable />
          </div>
        )}
      </div>
      {/* Row 3: the three donuts on a single line — equal heights,
          content centred so no card has a blank belly */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 14, marginBottom: 14, alignItems: "stretch" }}>
        {!has("src") && (
          <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Direct vs channel-partner</h3>
            <div style={CAP}>walk-in source · click a slice</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
<Donut
              segs={[
                { key: 1, label: "With CP", value: withCp, color: TEAL },
                { key: 0, label: "Direct", value: rows.filter(r => r.src === 0).length, color: BLUE },
                { key: 2, label: "Direct Loyalty", value: rows.filter(r => r.src === 2).length, color: GOLD },
                { key: 3, label: "Digital", value: rows.filter(r => r.src === 3).length, color: "#7b5cb8" },
              ].filter(s => s.value > 0)}
              onPick={(k, l) => openDrill("src")(k, l)}
            />
            </div>
          </div>
        )}
        {!has("age") && (
          <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Age group</h3>
            <div style={CAP}>
              {fNum(rows.filter(r => r.age >= 0).length)} of {fNum(total)} captured · click a band
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
<Donut
              segs={listFrom(ffCount(rows, r => r.age), FF.AGE, 12).map((s, i) => ({ ...s, color: PAL[i % PAL.length] }))}
              onPick={(k, l) => openDrill("age")(k, l)}
            />
            </div>
          </div>
        )}
        {!has("stg") && (
          <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Opportunity stage</h3>
            <div style={CAP}>current status mix · click a stage</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
<Donut
              segs={listFrom(ffCount(rows, r => r.stg), FF.STG, 8).map(s => ({
                ...s,
                color: s.label === "Booked" ? GREEN : s.label === "Closed Lost" ? RED : s.label === "In Progress" ? GOLD : s.label === "Site Visit" ? TEAL : BLUE,
              }))}
              onPick={(k, l) => openDrill("stg")(k, l)}
            />
            </div>
          </div>
        )}
      </div>
      {/* Row 4: trend + weekday */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        {!has("mon") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall trend</h3>
            <div style={CAP}>monthly volume with trend line · click a month</div>
            <TrendChart items={monthly} onPick={(k, l) => openDrill("mon")(k, l)} />
          </div>
        )}
        {!has("dow") && (
          <div style={CARD}>
            <h3 style={H3}>Weekday pattern</h3>
            <div style={CAP}>visits by day of week · click a day</div>
            <WeekdayChart items={weekday} onPick={(k, l) => openDrill("dow")(k, l)} />
          </div>
        )}
      </div>



      {/* Channel-partner performance board */}
      {!has("cp") && (
        <>
          <div>
            <Banner
              title="CHANNEL-PARTNER PERFORMANCE"
              sub={`${fNum(new Set(rows.filter(r => r.src === 1 && r.cp >= 0).map(r => r.cp)).size)} partners brought customer footfall · click a partner to drill`}
            />
          </div>
          <CpBoard rows={rows} onDrill={(cp, name) => openDrill("cp")(cp, name)} />
        </>
      )}

      <div><Banner title="SITE-VISIT RECORDS" sub={`${fNum(total)} in scope`} /></div>

      {/* Records table */}
      <div style={{ ...CARD, marginTop: 2, paddingBottom: 8 }}>
        <h3 style={H3}>Site-visit records <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--mut)" }}>{fNum(total)} in scope</span></h3>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                <th onClick={() => setSortDir(d => (d === 1 ? -1 : 1))} style={{ textAlign: "left", padding: "7px 8px 7px 0", cursor: "pointer", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>
                  Date {sortDir === -1 ? "▼" : "▲"}
                </th>
                {["Opp. No", "Gallery", "Project", "Source", "Channel partner", "Locality", "Stage"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} onClick={() => setRecDetail(r)} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                  <td style={{ padding: "7px 8px 7px 0", whiteSpace: "nowrap" }}>
                    {r.day >= 0 ? dayToDate(r.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                  </td>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 11.5 }}>{r.opp || "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.g >= 0 ? FF.G[r.g] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.p >= 0 ? FF.P[r.p] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.src === 1 ? "CP" : r.src === 0 ? "Direct" : r.src === 2 ? "Loyalty" : "—"}</td>
                  <td style={{ padding: "7px 8px", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cp >= 0 ? FF.CPN[r.cp] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.loc >= 0 ? FF.LOC[r.loc] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>
                    {r.stg >= 0 ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, borderRadius: 5, padding: "2px 8px",
                        background: FF.STG[r.stg] === "Booked" ? "#e2f3ec" : FF.STG[r.stg] === "Closed Lost" ? "#fde3e3" : "#eef1f7",
                        color: FF.STG[r.stg] === "Booked" ? "#0f6e56" : FF.STG[r.stg] === "Closed Lost" ? "#b3362c" : "#3d4a63",
                      }}>{FF.STG[r.stg]}</span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pager */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 6px", fontSize: 12.5, color: "var(--mut)" }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1, fontFamily: "inherit" }}>‹ Prev</button>
          <span>Page {page} of {fNum(pageCount)}</span>
          <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page >= pageCount ? "default" : "pointer", opacity: page >= pageCount ? 0.45 : 1, fontFamily: "inherit" }}>Next ›</button>
          <span style={{ marginLeft: "auto", fontSize: 11.5 }}>data as on {FF.meta.asOn}</span>
        </div>
      </div>
    </div>
  );
}
