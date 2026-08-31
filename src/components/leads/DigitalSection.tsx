import { useMemo, useState } from "react";
import raw from "../../data/digitalEnquiries.json";
import { dayToDate, dayToYm, ymLabel, DOW, fNum, periodPresets, type PeriodPreset } from "../../utils/footfallLogic";
import {
  HBarList, Donut, TrendChart, WeekdayChart, Banner, Spark,
  CARD, H3, CAP, PAL, BLUE, TEAL, GOLD, GREEN, RED,
} from "./footfallCharts";

/** Digital presales enquiries — full analytics preview of the 21-Aug
 * export (11,946 enquiries, Apr–Aug 2026), in the same visual system
 * as Footfall / CP Visits. Everything in the file is explained:
 * sub-source channels, presales status, projects, agencies, presales
 * owners, opportunity stages, daily/weekday cadence — plus the
 * enquiry → opportunity → site-visit → booking funnel. PII columns
 * (names, emails, phones) are deliberately NOT in the app dataset.
 * Click any bar/slice to filter every card at once (chips clear it). */

interface DigDataset {
  SUB: string[]; PRJ: string[]; STA: string[]; AGN: string[]; OWN: string[]; STG: string[];
  epoch: string; R: number[][];
  meta: { rows: number; source: string; asOn: string; note: string };
}
const DG = raw as unknown as DigDataset;

interface DigRec { sub: number; p: number; sta: number; ag: number; ow: number; stg: number; day: number }
const RECORDS: DigRec[] = DG.R.map(r => ({ sub: r[0], p: r[1], sta: r[2], ag: r[3], ow: r[4], stg: r[5], day: r[6] }));

type Dim = "sub" | "p" | "sta" | "ag" | "ow" | "stg" | "mon" | "dow";
interface Chip { dim: Dim; val: number | string; label: string }
const DIM_NAMES: Record<Dim, string> = {
  sub: "Sub source", p: "Project", sta: "Status", ag: "Agency", ow: "Owner", stg: "Opp. stage", mon: "Month", dow: "Weekday",
};

function applyChips(records: DigRec[], chips: Chip[]): DigRec[] {
  return records.filter(r =>
    chips.every(c => {
      switch (c.dim) {
        case "sub": return r.sub === c.val;
        case "p":   return r.p === c.val;
        case "sta": return r.sta === c.val;
        case "ag":  return r.ag === c.val;
        case "ow":  return r.ow === c.val;
        case "stg": return r.stg === c.val;
        case "mon": return r.day >= 0 && dayToYm(r.day) === c.val;
        case "dow": return r.day >= 0 && dayToDate(r.day).getDay() === c.val;
        default: return true;
      }
    })
  );
}

/** Digital funnel: enquiry → qualified → opportunity → site-visit-or-
 * beyond → booked. Qualified counts presales Status; the later steps
 * come from the opportunity Stage column (a stage exists ⇔ an
 * opportunity was created). Steps are nested populations. */
function digitalFunnel(rows: DigRec[]) {
  const total = rows.length;
  const QUAL = DG.STA.indexOf("Qualified");
  const svSet = new Set(["Site Visit", "In Progress", "Inventory", "Booked"].map(s => DG.STG.indexOf(s)).filter(i => i >= 0));
  const BK = DG.STG.indexOf("Booked");
  const qualified = rows.filter(r => r.sta === QUAL || r.stg >= 0).length; // qualified status OR already an opportunity
  const opp = rows.filter(r => r.stg >= 0).length;
  const sv = rows.filter(r => svSet.has(r.stg)).length;
  const booked = rows.filter(r => r.stg === BK).length;
  const lost = rows.filter(r => DG.STG[r.stg] === "Closed Lost").length;
  const steps = [
    { key: "enq", label: "Enquiries", value: total, hint: "every digital enquiry in scope" },
    { key: "qual", label: "Qualified", value: qualified, hint: "presales-qualified or already an opportunity" },
    { key: "opp", label: "Opportunity", value: opp, hint: "opportunity created in CRM" },
    { key: "sv", label: "Site visit+", value: sv, hint: "reached site visit / in-progress / inventory / booked" },
    { key: "bk", label: "Booked", value: booked, hint: "converted to a booking" },
  ].map((s, i, arr) => ({
    ...s,
    pctOfTotal: total ? (s.value / total) * 100 : 0,
    pctOfPrev: i === 0 ? 100 : arr[i - 1].value ? (s.value / arr[i - 1].value) * 100 : 0,
  }));
  return { steps, lost };
}

function DigitalFunnelCard({ rows }: { rows: DigRec[] }) {
  const { steps, lost } = digitalFunnel(rows);
  const max = Math.max(steps[0].value, 1);
  const COLORS = [BLUE, TEAL, GOLD, "#7b5cb8", GREEN];
  const cell: React.CSSProperties = { padding: "9px 10px", fontSize: 12.5, verticalAlign: "middle" };
  const th: React.CSSProperties = { ...cell, padding: "5px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)", textAlign: "left" };
  return (
    <div style={{ ...CARD, marginBottom: 14 }}>
      <h3 style={H3}>Conversion funnel — enquiry till booking</h3>
      <div style={CAP}>nested populations · recomputes with every filter</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--line)" }}>
              <th style={{ ...th, width: 118 }}>Step</th>
              <th style={th}>Volume</th>
              <th style={{ ...th, width: 92, textAlign: "right" }}>Of enquiries</th>
              <th style={{ ...th, width: 100, textAlign: "right" }}>Step conv.</th>
              <th style={{ ...th, width: 100, textAlign: "right" }}>Drop-off</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => {
              const prev = i === 0 ? s.value : steps[i - 1].value;
              const drop = i === 0 ? 0 : prev - s.value;
              return (
                <tr key={s.key} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ ...cell, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    {s.label}
                    <div style={{ fontSize: 10, fontWeight: 400, color: "var(--mut)" }}>{s.hint}</div>
                  </td>
                  <td style={{ ...cell, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 18, background: "#f0ede5", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(s.value / max) * 100}%`, background: COLORS[i], borderRadius: 6, transition: "width 0.4s cubic-bezier(0.22,1,0.36,1)" }} />
                      </div>
                      <b style={{ fontFamily: "Georgia,serif", fontSize: 13.5, color: "var(--ink)", whiteSpace: "nowrap" }}>{fNum(s.value)}</b>
                    </div>
                  </td>
                  <td style={{ ...cell, textAlign: "right", color: "var(--mut)", whiteSpace: "nowrap" }}>{s.pctOfTotal.toFixed(1)}%</td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: i === 0 ? "var(--mut)" : s.pctOfPrev >= 50 ? "#1a7a4a" : "#c07a1a" }}>
                    {i === 0 ? "—" : `${s.pctOfPrev.toFixed(1)}%`}
                  </td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", color: drop > 0 ? "#c0392b" : "var(--mut)" }}>
                    {i === 0 ? "—" : drop > 0 ? `−${fNum(drop)}` : "0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>
        Of the opportunities, <b style={{ color: RED }}>{fNum(lost)}</b> are closed lost · a Stage exists only once an opportunity is created, so most enquiries have no stage
      </div>
    </div>
  );
}

export function DigitalSection() {
  const [chips, setChips] = useState<Chip[]>([]);
  const PRESETS = useMemo(() => periodPresets(), []);
  const [perKey, setPerKey] = useState("all");
  const per: PeriodPreset = PRESETS.find(p => p.key === perKey) ?? PRESETS[0];
  const [page, setPage] = useState(1);
  const [showLogic, setShowLogic] = useState(false);

  const dimRows = useMemo(() => applyChips(RECORDS, chips), [chips]);
  const rows = useMemo(
    () => (per.key === "all" ? dimRows : dimRows.filter(r => r.day >= per.from && r.day <= per.to)),
    [dimRows, per]
  );
  const total = rows.length;

  function addChip(dim: Dim) {
    return (val: number | string, label: string) => {
      setChips(prev => [...prev.filter(c => c.dim !== dim), { dim, val, label }]);
      setPage(1);
    };
  }
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

  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => { if (r.day >= 0) { const ym = dayToYm(r.day); m.set(ym, (m.get(ym) ?? 0) + 1); } });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => ({ key, label: ymLabel(key), value }));
  }, [rows]);
  const weekday = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0, 0];
    rows.forEach(r => { if (r.day >= 0) c[dayToDate(r.day).getDay()]++; });
    return [1, 2, 3, 4, 5, 6, 0].map(d => ({ key: d, label: DOW[d], value: c[d] }));
  }, [rows]);

  const listFrom = (get: (r: DigRec) => number, names: string[], top = 10) => {
    const m = new Map<number, number>();
    rows.forEach(r => { const k = get(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);
  };

  const PER = 10;
  const sorted = useMemo(() => [...rows].sort((a, b) => b.day - a.day), [rows]);
  const pages = Math.max(1, Math.ceil(sorted.length / PER));
  const shown = sorted.slice((page - 1) * PER, page * PER);

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
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 5 }}>Period</div>
          <select
            style={{ fontFamily: "inherit", fontSize: 13, padding: "8px 12px", borderRadius: 9, border: "1.5px solid #cfd6e2", background: "#fff", color: "var(--ink)", cursor: "pointer", minWidth: 170 }}
            value={per.key} onChange={e => { setPerKey(e.target.value); setPage(1); }}>
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
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
        <KPI l="Opportunities" v={fNum(opp)} s={`${((opp / Math.max(total, 1)) * 100).toFixed(1)}% converted`} />
        <KPI l="Avg / active day" v={activeDays ? (total / activeDays).toFixed(0) : "0"} s={`${fNum(activeDays)} active days`} />
        <KPI l="Channels" v={fNum(new Set(rows.map(r => r.sub).filter(s => s >= 0)).size)} s="sub-sources in scope" />
      </div>

      <div><Banner title="DIGITAL LEADS ANALYSIS" sub={`${fNum(total)} enquiries · ${per.label}`} /></div>

      <DigitalFunnelCard rows={rows} />

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>
        {!has("sub") && (
          <div style={CARD}>
            <h3 style={H3}>By sub-source</h3>
            <div style={CAP}>where enquiries come from · click → channel</div>
            <HBarList items={listFrom(r => r.sub, DG.SUB)} total={total} color={BLUE} onPick={addChip("sub")} />
          </div>
        )}
        {!has("sta") && (
          <div style={CARD}>
            <h3 style={H3}>Presales status</h3>
            <div style={CAP}>qualification outcome · click a slice</div>
            <Donut
              segs={listFrom(r => r.sta, DG.STA, 6).map(s => ({
                ...s,
                color: s.label === "Qualified" ? GREEN : s.label === "Not Qualified" ? RED : s.label === "In Progress" ? GOLD : TEAL,
              }))}
              onPick={addChip("sta")}
            />
          </div>
        )}
        {!has("p") && (
          <div style={CARD}>
            <h3 style={H3}>By project / campaign</h3>
            <div style={CAP}>click → project</div>
            <HBarList items={listFrom(r => r.p, DG.PRJ)} total={total} color={GOLD} onPick={addChip("p")} />
          </div>
        )}
        {!has("ag") && (
          <div style={CARD}>
            <h3 style={H3}>Agency source</h3>
            <div style={CAP}>top 10 agencies · click → agency</div>
            <HBarList items={listFrom(r => r.ag, DG.AGN)} total={total} color={TEAL} onPick={addChip("ag")} />
          </div>
        )}
        {!has("ow") && (
          <div style={CARD}>
            <h3 style={H3}>Presales owner</h3>
            <div style={CAP}>enquiries handled · click → owner</div>
            <HBarList items={listFrom(r => r.ow, DG.OWN)} total={total} color="#7b5cb8" onPick={addChip("ow")} />
          </div>
        )}
        {!has("stg") && (
          <div style={CARD}>
            <h3 style={H3}>Opportunity stage</h3>
            <div style={CAP}>{fNum(opp)} enquiries became opportunities · click a stage</div>
            <Donut
              segs={listFrom(r => r.stg, DG.STG, 8).map((s, i) => ({
                ...s,
                color: s.label === "Booked" ? GREEN : s.label === "Closed Lost" ? RED : s.label === "In Progress" ? GOLD : PAL[i % PAL.length],
              }))}
              onPick={addChip("stg")}
            />
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14, marginTop: 14 }}>
        {!has("mon") && (
          <div style={CARD}>
            <h3 style={H3}>Enquiry trend</h3>
            <div style={CAP}>monthly volume · click a month</div>
            <TrendChart items={monthly} onPick={addChip("mon")} />
          </div>
        )}
        {!has("dow") && (
          <div style={CARD}>
            <h3 style={H3}>Weekday pattern</h3>
            <div style={CAP}>enquiries by day of week · click a day</div>
            <WeekdayChart items={weekday} onPick={addChip("dow")} />
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
