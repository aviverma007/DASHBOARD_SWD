import { useMemo, useState } from "react";
import {
  FF, ffScope, ffCount, ffMonthly, ffWeekday, fNum, dayToDate,
  periodPresets, type PeriodPreset,
  type FfFilter, type FfDim,
} from "../../utils/footfallLogic";
import {
  HBarList, Donut, TrendChart, WeekdayChart, FunnelChart, Banner, Spark,
  MomentumCard, CpBoard, CARD, H3, CAP, SEL, SELLBL, PAL, BLUE, TEAL, GOLD, GREEN, RED,
} from "./footfallCharts";
import { FootfallDrillDrawer, type DrillSeed } from "./FootfallDrillDrawer";

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
  const per: PeriodPreset = PRESETS.find(p => p.key === perKey) ?? PRESETS[0];

  // Dimension filters first, then the global period window
  const dimRows = useMemo(() => ffScope(filters), [filters]);
  const rows = useMemo(
    () => (per.key === "all" ? dimRows : dimRows.filter(r => r.day >= per.from && r.day <= per.to)),
    [dimRows, per]
  );
  const total = rows.length;

  function addFilter(dim: FfDim, val: number | string, label: string) {
    setFilters(prev => [...prev.filter(f => f.dim !== dim), { dim, val, label }]);
    setPage(1);
  }
  function removeFilter(dim: FfDim) {
    setFilters(prev => prev.filter(f => f.dim !== dim));
    setPage(1);
  }
  const has = (dim: FfDim) => filters.some(f => f.dim === dim);

  // KPI computations (mirroring the reference)
  const direct = rows.filter(r => r.src === 0 || r.src === 2).length;
  const withCp = rows.filter(r => r.src === 1).length;
  const uProj = new Set(rows.map(r => r.p)).size;
  const activeDays = new Set(rows.filter(r => r.day >= 0).map(r => r.day)).size;
  const perDay = activeDays ? total / activeDays : 0;
  const bookedPct = total ? (rows.filter(r => FF.STG[r.stg] === "Booked").length / total) * 100 : 0;

  const monthly = useMemo(() => ffMonthly(rows), [rows]);
  const weekday = useMemo(() => ffWeekday(rows), [rows]);

  const listFrom = (map: Map<number, number>, names: string[], top = 10) =>
    [...map.entries()].filter(([k]) => k >= 0).map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => sortDir * (a.day - b.day)),
    [rows, sortDir]
  );
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const shown = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const KPI = ({ l, v, s }: { l: string; v: string; s?: string }) => (
    <div className="card" style={{ ...CARD, padding: "13px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{l}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      {s && <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1 }}>{s}</div>}
    </div>
  );

  const projFilter = filters.find(f => f.dim === "p");
  const [drill, setDrill] = useState<DrillSeed | null>(null);
  const openDrill = (dim: FfDim) => (val: number | string, label: string) => setDrill({ dim, val, label });

  return (
    <div>
      <FootfallDrillDrawer
        seed={drill}
        baseRows={rows}
        baseLabel={`${projFilter ? projFilter.label + " · " : ""}${per.label}`}
        onClose={() => setDrill(null)}
      />
      {/* Global filter bar — project + period, reference-style */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={SELLBL}>Project / campaign</div>
          <select
            style={SEL}
            value={projFilter ? String(projFilter.val) : "all"}
            onChange={e => {
              const v = e.target.value;
              if (v === "all") removeFilter("p");
              else addFilter("p", Number(v), FF.P[Number(v)]);
            }}
          >
            <option value="all">All projects</option>
            {FF.P.map((p, i) => <option key={p} value={i}>{p}</option>)}
          </select>
        </div>
        <div>
          <div style={SELLBL}>Period</div>
          <select style={SEL} value={per.key} onChange={e => { setPerKey(e.target.value); setPage(1); }}>
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
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

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>
        {!has("g") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall by gallery</h3>
            <div style={CAP}>click → gallery</div>
            <HBarList items={listFrom(ffCount(rows, r => r.g), FF.G)} total={total} color={BLUE} onPick={(k, l) => openDrill("g")(k, l)} />
          </div>
        )}
        {!has("src") && (
          <div style={CARD}>
            <h3 style={H3}>Direct vs channel-partner</h3>
            <div style={CAP}>walk-in source · click a slice</div>
            <Donut
              segs={[
                { key: 1, label: "With CP", value: withCp, color: TEAL },
                { key: 0, label: "Direct", value: rows.filter(r => r.src === 0).length, color: BLUE },
                { key: 2, label: "Direct Loyalty", value: rows.filter(r => r.src === 2).length, color: GOLD },
              ].filter(s => s.value > 0)}
              onPick={(k, l) => openDrill("src")(k, l)}
            />
          </div>
        )}
        {!has("p") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall by project</h3>
            <div style={CAP}>top 10 · click → project</div>
            <HBarList items={listFrom(ffCount(rows, r => r.p), FF.P)} total={total} color={GOLD} onPick={(k, l) => openDrill("p")(k, l)} />
          </div>
        )}
        {!has("loc") && (
          <div style={CARD}>
            <h3 style={H3}>Customer locality</h3>
            <div style={CAP}>top 10 · click → locality</div>
            <HBarList items={listFrom(ffCount(rows, r => r.loc), FF.LOC)} total={total} color={TEAL} onPick={(k, l) => openDrill("loc")(k, l)} />
          </div>
        )}
        {!has("age") && (
          <div style={CARD}>
            <h3 style={H3}>Age group</h3>
            <div style={CAP}>
              {fNum(rows.filter(r => r.age >= 0).length)} of {fNum(total)} captured · click a band
            </div>
            <Donut
              segs={listFrom(ffCount(rows, r => r.age), FF.AGE, 12).map((s, i) => ({ ...s, color: PAL[i % PAL.length] }))}
              onPick={(k, l) => openDrill("age")(k, l)}
            />
          </div>
        )}
        {!has("stg") && (
          <div style={CARD}>
            <h3 style={H3}>Opportunity stage</h3>
            <div style={CAP}>current status mix · click a stage</div>
            <Donut
              segs={listFrom(ffCount(rows, r => r.stg), FF.STG, 8).map(s => ({
                ...s,
                color: s.label === "Booked" ? GREEN : s.label === "Closed Lost" ? RED : s.label === "In Progress" ? GOLD : s.label === "Site Visit" ? TEAL : BLUE,
              }))}
              onPick={(k, l) => openDrill("stg")(k, l)}
            />
          </div>
        )}
      </div>

      {/* Trend + weekday */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14, marginTop: 14 }}>
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
                {["Gallery", "Project", "Source", "Channel partner", "Locality", "Stage"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "7px 8px 7px 0", whiteSpace: "nowrap" }}>
                    {r.day >= 0 ? dayToDate(r.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                  </td>
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
          <span style={{ marginLeft: "auto", fontSize: 11.5 }}>{FF.meta.source}</span>
        </div>
      </div>
    </div>
  );
}
