import { useMemo, useState } from "react";
import {
  FF, FF_RECORDS, ffApply, ffCount, ffMonthly, ffWeekday, fNum, dayToYm, ymLabel, isoToDay,
  periodPresets, type PeriodPreset, type FfFilter, type FfDim,
} from "../../utils/footfallLogic";
import {
  HBarList, Donut, TrendChart, WeekdayChart, Banner, Spark, MomentumCard, CpBoard,
  CARD, H3, CAP, SEL, SELLBL, BLUE, TEAL, GOLD,
} from "./footfallCharts";
import { FootfallDrillDrawer, type DrillSeed } from "./FootfallDrillDrawer";

/** Channel-partner visits — a clone of the reference suite's
 * "Channel partner visits" tab, computed from the SAME 21-Aug Excel:
 * every CP-sourced customer site visit counts as one CP gallery
 * visit. KPIs: gallery visits (spark), unique partners, new partners
 * (first-ever visit inside the selected period), revisits, avg
 * visits/CP · momentum card · engagement banner · cards: visits by
 * gallery, visit-vs-revisit, visits-per-partner distribution, active
 * partners/month, visits trend, weekday · partner board · drill
 * drawer everywhere. */

/** First-ever visit day per partner, over ALL data (not the period),
 * so "new partner" means first appearance ever — like the reference. */
function firstVisitMap(): Map<number, number> {
  const m = new Map<number, number>();
  FF_RECORDS.forEach(r => {
    if (r.src !== 1 || r.cp < 0 || r.day < 0) return;
    const cur = m.get(r.cp);
    if (cur === undefined || r.day < cur) m.set(r.cp, r.day);
  });
  return m;
}

export function CpVisitsSection() {
  const [filters, setFilters] = useState<FfFilter[]>([]);
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
  const [drill, setDrill] = useState<DrillSeed | null>(null);

  const FIRST = useMemo(() => firstVisitMap(), []);

  // CP-sourced rows only → dimension filters → period window
  const cpAll = useMemo(() => FF_RECORDS.filter(r => r.src === 1), []);
  const dimRows = useMemo(() => ffApply(cpAll, filters), [cpAll, filters]);
  const rows = useMemo(
    () => (per.key === "all" ? dimRows : dimRows.filter(r => r.day >= per.from && r.day <= per.to)),
    [dimRows, per]
  );
  const total = rows.length;

  function addFilter(dim: FfDim, val: number | string, label: string) {
    setFilters(prev => [...prev.filter(f => f.dim !== dim), { dim, val, label }]);
  }
  function removeFilter(dim: FfDim) {
    setFilters(prev => prev.filter(f => f.dim !== dim));
  }
  const projFilter = filters.find(f => f.dim === "p");
  const openDrill = (dim: FfDim) => (val: number | string, label: string) => setDrill({ dim, val, label });

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
  const monthly = useMemo(() => ffMonthly(rows), [rows]);
  const weekday = useMemo(() => ffWeekday(rows), [rows]);

  // Active partners per month
  const activeMonthly = useMemo(() => {
    const m = new Map<string, Set<number>>();
    rows.forEach(r => {
      if (r.day < 0 || r.cp < 0) return;
      const ym = dayToYm(r.day);
      if (!m.has(ym)) m.set(ym, new Set());
      m.get(ym)!.add(r.cp);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, s]) => ({ key, label: ymLabel(key), value: s.size }));
  }, [rows]);

  const listFrom = (map: Map<number, number>, names: string[], top = 10) =>
    [...map.entries()].filter(([k]) => k >= 0).map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);

  const KPI = ({ l, v, s, spark }: { l: string; v: string; s?: string; spark?: boolean }) => (
    <div className="card" style={{ ...CARD, padding: "13px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{l}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      {s && <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1 }}>{s}</div>}
      {spark && <Spark items={monthly.slice(-18)} />}
    </div>
  );

  return (
    <div>
      <FootfallDrillDrawer
        seed={drill}
        baseRows={rows}
        baseLabel={`CP visits · ${projFilter ? projFilter.label + " · " : ""}${per.label}`}
        onClose={() => setDrill(null)}
        showBooking={false}
      />

      {/* Global filter bar */}
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
          <select style={SEL} value={perKey} onChange={e => setPerKey(e.target.value)}>
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

      {/* Momentum */}
      <MomentumCard records={dimRows} showBooked={false} />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 4 }}>
        <KPI l="CP gallery visits" v={fNum(total)} s={per.label} spark />
        <KPI l="Unique partners" v={fNum(uniq.size)} s="visited" />
        <KPI l="New partners" v={fNum(newPartners)} s="first-ever visit" />
        <KPI l="Revisits" v={fNum(revisits)} s={`${((revisits / Math.max(total, 1)) * 100).toFixed(1)}%`} />
        <KPI l="Avg visits / CP" v={uniq.size ? (total / uniq.size).toFixed(1) : "0"} />
      </div>

      <div><Banner title="CHANNEL PARTNER ENGAGEMENT" sub={`${fNum(total)} gallery visits · ${per.label} · CP data only`} /></div>

      {/* Row 1: gallery + project — same size, project scrolls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14, alignItems: "stretch" }}>
        <div style={CARD}>
          <h3 style={H3}>CP visits by gallery</h3>
          <div style={CAP}>click → gallery breakdown</div>
          <HBarList items={listFrom(ffCount(rows, r => r.g), FF.G)} total={total} color={BLUE} onPick={(k, l) => openDrill("g")(k, l)} />
        </div>
        <div style={CARD}>
          <h3 style={H3}>CP visits by project</h3>
          <div style={CAP}>top 10 · click → project breakdown</div>
          <HBarList items={listFrom(ffCount(rows, r => r.p), FF.P)} total={total} color={GOLD} onPick={(k, l) => openDrill("p")(k, l)} maxHeight={196} />
        </div>
      </div>
      {/* Row 2: visit-vs-revisit + weekday */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14, alignItems: "stretch" }}>
        <div style={CARD}>
          <h3 style={H3}>Visit vs revisit</h3>
          <div style={CAP}>revisit = the partner had visited before that day</div>
          <Donut
            segs={[
              { key: 0, label: "Revisit", value: revisits, color: TEAL },
              { key: 1, label: "First visit", value: firstTimers, color: GOLD },
            ].filter(s => s.value > 0)}
          />
        </div>
        <div style={CARD}>
          <h3 style={H3}>Weekday pattern</h3>
          <div style={CAP}>visits by day of week · click a day</div>
          <WeekdayChart items={weekday} onPick={(k, l) => openDrill("dow")(k, l)} />
        </div>
      </div>
      {/* Row 3: the two trends */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14, alignItems: "stretch" }}>
        <div style={CARD}>
          <h3 style={H3}>CP visits trend</h3>
          <div style={CAP}>monthly gallery visits · click a month</div>
          <TrendChart items={monthly} onPick={(k, l) => openDrill("mon")(k, l)} />
        </div>
        <div style={CARD}>
          <h3 style={H3}>Active partners / month</h3>
          <div style={CAP}>distinct partners who visited that month</div>
          <TrendChart items={activeMonthly} />
        </div>
      </div>

      {/* Partner board */}
      <div>
        <Banner
          title="CHANNEL-PARTNER PERFORMANCE"
          sub={`${fNum(uniq.size)} partners · click a partner to drill`}
        />
      </div>
      <CpBoard rows={rows} onDrill={(cp, name) => openDrill("cp")(cp, name)} showBooked={false} visitsLabel="CP visits" />

      <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 12 }}>
        Source: {FF.meta.source} · a "CP gallery visit" = a customer site visit with Walk-in Source = Channel Partner;
        new partner = first-ever visit falls inside the selected period; revisit = the partner already had an earlier visit.
      </div>
    </div>
  );
}
