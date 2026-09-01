import { useMemo, useState } from "react";
import { showTip, hideTip } from "../common/hoverTip";
import { dayToDate, fNum, isoToDay, periodPresets, type PeriodPreset } from "../../utils/footfallLogic";
import {
  StackedHBarList, Donut, TrendChart, WeekdayChart, Banner, Spark,
  CARD, H3, CAP, SEL, SELLBL, PAL, BLUE, TEAL, GOLD, GREEN, RED,
} from "./footfallCharts";
import {
  DG, RECORDS, applyChips, digMonthly, digWeekday,
  DIM_NAMES, type Dim, type Chip, type DigRec,
} from "./digitalShared";
import { DigitalFunnelCard } from "./DigitalFunnelCard";
import { DigitalDrillDrawer } from "./DigitalDrillDrawer";

/** Digital presales enquiries — full analytics preview of the 21-Aug
 * export (11,946 enquiries, Apr–Aug 2026), in the same visual system
 * as Footfall / CP Visits. Everything in the file is explained:
 * sub-source channels, presales status, projects, agencies, presales
 * owners, opportunity stages, daily/weekday cadence — plus the
 * enquiry → opportunity → site-visit → booking funnel. PII columns
 * (names, emails, phones) are deliberately NOT in the app dataset.
 * Click any bar/slice to filter every card at once (chips clear it). */

export function DigitalSection() {
  const [chips, setChips] = useState<Chip[]>([]);
  const [drill, setDrill] = useState<import("./DigitalDrillDrawer").DigDrillSeed | null>(null);
  const openDrill = (dim: Dim) => (val: number | string, label: string) => setDrill({ dim, val, label });
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
  const [page, setPage] = useState(1);
  const [showLogic, setShowLogic] = useState(false);

  const dimRows = useMemo(() => applyChips(RECORDS, chips), [chips]);
  const rows = useMemo(
    () => (per.key === "all" ? dimRows : dimRows.filter(r => r.day >= per.from && r.day <= per.to)),
    [dimRows, per]
  );
  const total = rows.length;

  function removeChip(dim: Dim) {
    setChips(prev => prev.filter(c => c.dim !== dim));
    setPage(1);
  }
  const has = (dim: Dim) => chips.some(c => c.dim === dim);

  // KPIs
  const QUAL = DG.STA.indexOf("Qualified");
  const qualified = rows.filter(r => r.sta === QUAL).length;
  const opp = rows.filter(r => r.stg >= 0).length;
  const activeDays = new Set(rows.filter(r => r.day >= 0).map(r => r.day)).size;

  const monthly = useMemo(() => digMonthly(rows), [rows]);
  const weekday = useMemo(() => digWeekday(rows), [rows]);

  const listFrom = (get: (r: DigRec) => number, names: string[], top = 99999) => {
    const m = new Map<number, number>();
    rows.forEach(r => { const k = get(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);
  };
  /** Stacked variant: total + qualified count per dimension value. */
  const QUAL_I = DG.STA.indexOf("Qualified");
  const stackedFrom = (get: (r: DigRec) => number, names: string[]) => {
    const tot = new Map<number, number>(), ql = new Map<number, number>();
    rows.forEach(r => {
      const k = get(r);
      if (k < 0) return;
      tot.set(k, (tot.get(k) ?? 0) + 1);
      if (r.sta === QUAL_I) ql.set(k, (ql.get(k) ?? 0) + 1);
    });
    return [...tot.entries()].map(([key, value]) => ({ key, label: names[key], value, hl: ql.get(key) ?? 0 }))
      .sort((a, b) => b.value - a.value);
  };

  const PER = 10;
  const sorted = useMemo(() => [...rows].sort((a, b) => b.day - a.day), [rows]);
  const pages = Math.max(1, Math.ceil(sorted.length / PER));
  const shown = sorted.slice((page - 1) * PER, page * PER);

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

  return (
    <div>
      <DigitalDrillDrawer
        seed={drill}
        baseRows={rows}
        baseLabel={per.label}
        onClose={() => setDrill(null)}
      />

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 5 }}>Period</div>
          <select
            style={SEL}
            value={perKey} onChange={e => { setPerKey(e.target.value); setPage(1); }}>
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
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingBottom: 4 }}>
            {chips.map(c => (
              <button key={c.dim} onClick={() => removeChip(c.dim)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#1E3163", color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", opacity: 0.7 }}>{DIM_NAMES[c.dim].toUpperCase()}</span>
                {c.label} <span style={{ opacity: 0.7 }}>✕</span>
              </button>
            ))}
            <button onClick={() => { setChips([]); setPage(1); }}
              style={{ background: "none", border: "none", color: "#c07a1a", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 4 }}>
        <KPI l="Digital enquiries" v={fNum(total)} s={`${per.label} · till ${DG.meta.asOn}`} spark />
        <KPI l="Qualified" v={fNum(qualified)} s={`${((qualified / Math.max(total, 1)) * 100).toFixed(1)}% of enquiries`} />
        <KPI l="Avg / active day" v={activeDays ? (total / activeDays).toFixed(0) : "0"} s={`${fNum(activeDays)} active days`} />
        <KPI l="Channels" v={fNum(new Set(rows.map(r => r.sub).filter(s => s >= 0)).size)} s="sub-sources in scope" />
      </div>

      <div><Banner title="DIGITAL LEADS ANALYSIS" sub={`${fNum(total)} enquiries · ${per.label}`} /></div>

      <DigitalFunnelCard rows={rows} />

      {/* Row 1: sub-source + project — same size, both scroll */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        {!has("sub") && (
          <div style={CARD}>
            <h3 style={H3}>By sub-source</h3>
            <div style={CAP}>all channels · qualified overlay · click → channel</div>
            <StackedHBarList items={stackedFrom(r => r.sub, DG.SUB)} total={total} color={BLUE} hlColor={GREEN} hlLabel="Qualified" onPick={openDrill("sub")} maxHeight={300} sortable />
          </div>
        )}
        {!has("p") && (
          <div style={CARD}>
            <h3 style={H3}>By project / campaign</h3>
            <div style={CAP}>all projects · qualified overlay · click → project</div>
            <StackedHBarList items={stackedFrom(r => r.p, DG.PRJ)} total={total} color={GOLD} hlColor={GREEN} hlLabel="Qualified" onPick={openDrill("p")} maxHeight={300} sortable />
          </div>
        )}
      </div>
      {/* Row 2: agency + owner — same size, both scroll */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        {!has("ag") && (
          <div style={CARD}>
            <h3 style={H3}>Agency source</h3>
            <div style={CAP}>all agencies · qualified overlay · click → agency</div>
            <StackedHBarList items={stackedFrom(r => r.ag, DG.AGN)} total={total} color={TEAL} hlColor={GREEN} hlLabel="Qualified" onPick={openDrill("ag")} maxHeight={300} sortable />
          </div>
        )}
        {!has("ow") && (
          <div style={CARD}>
            <h3 style={H3}>Presales owner</h3>
            <div style={CAP}>all owners · qualified overlay · click → owner</div>
            <StackedHBarList items={stackedFrom(r => r.ow, DG.OWN)} total={total} color="#7b5cb8" hlColor={GREEN} hlLabel="Qualified" onPick={openDrill("ow")} maxHeight={300} sortable />
          </div>
        )}
      </div>
      {/* Row 3: the two donuts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "stretch" }}>
        {!has("sta") && (
          <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Presales status</h3>
            <div style={CAP}>qualification outcome · click a slice</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
<Donut
              segs={listFrom(r => r.sta, DG.STA, 6).map(s => ({
                ...s,
                color: s.label === "Qualified" ? GREEN : s.label === "Not Qualified" ? RED : s.label === "In Progress" ? GOLD : TEAL,
              }))}
              onPick={openDrill("sta")}
            />
            </div>
          </div>
        )}
        {!has("stg") && (
          <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Opportunity stage</h3>
            <div style={CAP}>{fNum(opp)} enquiries became opportunities · click a stage</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
<Donut
              segs={listFrom(r => r.stg, DG.STG, 8).map((s, i) => ({
                ...s,
                color: s.label === "Booked" ? GREEN : s.label === "Closed Lost" ? RED : s.label === "In Progress" ? GOLD : PAL[i % PAL.length],
              }))}
              onPick={openDrill("stg")}
            />
            </div>
          </div>
        )}
      </div>
      {/* Row 4: trend + weekday */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        {!has("mon") && (
          <div style={CARD}>
            <h3 style={H3}>Enquiry trend</h3>
            <div style={CAP}>monthly volume · click a month</div>
            <TrendChart items={monthly} onPick={openDrill("mon")} />
          </div>
        )}
        {!has("dow") && (
          <div style={CARD}>
            <h3 style={H3}>Weekday pattern</h3>
            <div style={CAP}>enquiries by day of week · click a day</div>
            <WeekdayChart items={weekday} onPick={openDrill("dow")} />
          </div>
        )}
      </div>



      {/* Records */}
      <div><Banner title="ENQUIRY RECORDS" sub={`${fNum(total)} in scope · PII excluded`} /></div>
      <div style={{ ...CARD, paddingBottom: 6 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                {["Date", "Sub source", "Project", "Status", "Agency", "Owner", "Opp. stage"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{r.day >= 0 ? dayToDate(r.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.sub >= 0 ? DG.SUB[r.sub] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.p >= 0 ? DG.PRJ[r.p] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>
                    {r.sta >= 0 ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, borderRadius: 5, padding: "2px 8px",
                        background: DG.STA[r.sta] === "Qualified" ? "#e2f3ec" : DG.STA[r.sta] === "Not Qualified" ? "#fde3e3" : "#eef1f7",
                        color: DG.STA[r.sta] === "Qualified" ? "#0f6e56" : DG.STA[r.sta] === "Not Qualified" ? "#b3362c" : "#3d4a63",
                      }}>{DG.STA[r.sta]}</span>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "7px 8px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ag >= 0 ? DG.AGN[r.ag] : "—"}</td>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{r.ow >= 0 ? DG.OWN[r.ow] : "—"}</td>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{r.stg >= 0 ? DG.STG[r.stg] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 6px", fontSize: 12.5, color: "var(--mut)" }}>
          <span>Page {page} of {fNum(pages)}</span>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ marginLeft: "auto", border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1, fontFamily: "inherit" }}>‹ Prev</button>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.45 : 1, fontFamily: "inherit" }}>Next ›</button>
        </div>
      </div>

      {/* Logic explainer */}
      <div style={{ ...CARD, marginTop: 12 }}>
        <button onClick={() => setShowLogic(v => !v)}
          style={{ background: "none", border: "none", fontFamily: "Georgia,serif", fontSize: 14.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer", padding: 0 }}>
          {showLogic ? "▾" : "▸"} How these numbers are calculated
        </button>
        {showLogic && (
          <div style={{ fontSize: 12.5, color: "#3d4a63", lineHeight: 1.65, marginTop: 8 }}>
            Every figure is a straight count over the rows of {DG.meta.source} ("Digital Presales Enquiry" sheet, {fNum(DG.meta.rows)} enquiries,
            Apr–Aug 2026) matching the active filters — no sampling or estimation.
            <b> Qualified</b> counts the presales Status column. <b>Opportunities</b> = enquiries where an opportunity Stage exists
            (a stage appears only once CRM creates the opportunity — {fNum(1925)} of {fNum(11946)} overall).
            <b> Funnel</b> steps are nested populations: Qualified = presales-qualified OR already an opportunity;
            Site&nbsp;visit+ = stage at Site Visit / In Progress / Inventory / Booked; Booked = stage exactly "Booked".
            <b> Agency</b> names are case-normalised (Alchemist/alchemist merged). Blank cells are excluded from that card
            but never from totals. {DG.meta.note}.
          </div>
        )}
      </div>
    </div>
  );
}
