import { useMemo, useState } from "react";
import {
  FF, ffScope, ffCount, ffMonthly, ffWeekday, ffFunnel, fNum, dayToDate,
  type FfFilter, type FfDim, type FfRecord,
} from "../../utils/footfallLogic";

/** Customer-footfall analysis, modelled on the reference suite's
 * footfall tab and rebuilt over the 21-Aug export (54,222 visits):
 * KPI strip · click-to-filter cards (gallery, source donut, project,
 * locality, age donut, monthly trend, weekday) · a conversion FUNNEL
 * from Opportunity Stage (our addition) · paginated records table.
 * Clicking any bar/slice/month/weekday narrows every card at once;
 * active filters show as removable chips. */

const BLUE = "#1E3163", TEAL = "#0e7490", GOLD = "#B8893C", GREEN = "#1a7a4a", RED = "#c0392b";
const PAL = ["#1E3163", "#0e7490", "#B8893C", "#1a7a4a", "#7b5cb8", "#c0392b", "#5a8a9c", "#a8821b", "#446688", "#888066"];

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px" };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: 0 };
const CAP: React.CSSProperties = { fontSize: 11.5, color: "#c07a1a", marginTop: 2, marginBottom: 10 };

// ── Small chart primitives (SVG, matching the reference look) ──────────

function HBarList({ items, total, color, onPick }: {
  items: { key: number; label: string; value: number }[];
  total: number; color: string; onPick?: (key: number, label: string) => void;
}) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div>
      {items.map(it => (
        <div key={it.key} onClick={() => onPick?.(it.key, it.label)} style={{ padding: "4px 0", cursor: onPick ? "pointer" : "default" }} className="barrow">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
            <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{it.label}</span>
            <span style={{ color: "var(--mut)" }}>{fNum(it.value)} · {((it.value / Math.max(total, 1)) * 100).toFixed(1)}%</span>
          </div>
          <div style={{ height: 9, background: "#f0ede5", borderRadius: 5 }}>
            <div style={{ height: "100%", width: `${(it.value / max) * 100}%`, background: color, borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ segs, onPick }: {
  segs: { key: number; label: string; value: number; color: string }[];
  onPick?: (key: number, label: string) => void;
}) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const r = 54, cx = 66, cy = 66, sw = 20, C = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 132 132" width="132" height="132">
        {segs.map(s => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ cursor: onPick ? "pointer" : "default" }}
              onClick={() => onPick?.(s.key, s.label)}
            />
          );
          off += len;
          return el;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="Georgia,serif" fontSize="17" fontWeight="700" fill="var(--ink)">{fNum(total)}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8.5" letterSpacing="1" fill="var(--mut)">TOTAL</text>
      </svg>
      <div style={{ flex: 1, minWidth: 150 }}>
        {segs.map(s => (
          <div key={s.key} onClick={() => onPick?.(s.key, s.label)} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "3px 0", cursor: onPick ? "pointer" : "default" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <b style={{ marginLeft: "auto", color: "var(--ink)" }}>{fNum(s.value)}</b>
            <span style={{ color: "var(--mut)", width: 44, textAlign: "right" }}>{((s.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ items, onPick }: {
  items: { key: string; label: string; value: number }[];
  onPick?: (key: string, label: string) => void;
}) {
  const w = 560, h = 170, padB = 24, padT = 20;
  const max = Math.max(...items.map(x => x.value), 1);
  const n = items.length || 1, gap = n > 24 ? 1 : 3, bw = (w - (n - 1) * gap) / n;
  const cy = (v: number) => h - padB - (v / max) * (h - padB - padT);
  const pts = items.map((it, i) => `${i * (bw + gap) + bw / 2},${cy(it.value)}`).join(" ");
  const every = Math.max(1, Math.ceil(n / 12));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
      {items.map((it, i) => (
        <rect key={it.key} x={i * (bw + gap)} y={cy(it.value)} width={bw} height={h - padB - cy(it.value)} rx="2" fill="#D7E2F0"
          style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(it.key, it.label)}>
          <title>{it.label}: {fNum(it.value)}</title>
        </rect>
      ))}
      <polyline points={pts} fill="none" stroke={GOLD} strokeWidth="2" />
      {items.map((it, i) => (
        <circle key={"d" + it.key} cx={i * (bw + gap) + bw / 2} cy={cy(it.value)} r="2.6" fill={GOLD} />
      ))}
      {items.map((it, i) =>
        i % every === 0 ? (
          <text key={"l" + it.key} x={i * (bw + gap) + bw / 2} y={h - 8} textAnchor="middle" fontSize="9" fill="#8a93a6">{it.label}</text>
        ) : null
      )}
    </svg>
  );
}

function WeekdayChart({ items, onPick }: {
  items: { key: number; label: string; value: number }[];
  onPick?: (key: number, label: string) => void;
}) {
  const w = 560, h = 160, padB = 24, padT = 18;
  const max = Math.max(...items.map(x => x.value), 1);
  const gap = 14, bw = (w - 6 * gap) / 7;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
      {items.map((it, i) => {
        const bh = (it.value / max) * (h - padB - padT);
        return (
          <g key={it.key} style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(it.key, it.label)}>
            <rect x={i * (bw + gap)} y={h - padB - bh} width={bw} height={bh} rx="4" fill={TEAL} opacity={0.85}>
              <title>{it.label}: {fNum(it.value)}</title>
            </rect>
            <text x={i * (bw + gap) + bw / 2} y={h - padB - bh - 5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0e7490">{fNum(it.value)}</text>
            <text x={i * (bw + gap) + bw / 2} y={h - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1f2937">{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Conversion funnel — trapezoid bands narrowing by population, with
 * step-to-step and of-total percentages, plus the closed-lost leak. */
function FunnelChart({ records }: { records: FfRecord[] }) {
  const { steps, lost, blank } = ffFunnel(records);
  const w = 560, bandH = 54, gapH = 26, padX = 10;
  const h = steps.length * bandH + (steps.length - 1) * gapH + 8;
  const max = Math.max(steps[0].value, 1);
  const COLORS = [BLUE, TEAL, GOLD, GREEN];
  const widthFor = (v: number) => Math.max((v / max) * (w - padX * 2), 60);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
        {steps.map((s, i) => {
          const topW = widthFor(s.value);
          const nextW = i < steps.length - 1 ? widthFor(steps[i + 1].value) : topW;
          const y = i * (bandH + gapH);
          const x0 = (w - topW) / 2, x1 = (w - nextW) / 2;
          return (
            <g key={s.key}>
              <rect x={x0} y={y} width={topW} height={bandH} rx="9" fill={COLORS[i]} />
              {i < steps.length - 1 && (
                <path d={`M${x1} ${y + bandH + gapH} L${x0 + topW / 2 - 12} ${y + bandH} L${x0 + topW / 2 + 12} ${y + bandH} L${w - x1} ${y + bandH + gapH} Z`}
                  fill={COLORS[i + 1]} opacity="0.18" />
              )}
              <text x={w / 2} y={y + 22} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{s.label} — {fNum(s.value)}</text>
              <text x={w / 2} y={y + 40} textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,.85)">
                {s.pctOfTotal.toFixed(1)}% of footfall{i > 0 ? ` · ${s.pctOfPrev.toFixed(1)}% of previous` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>
        Leakage: <b style={{ color: RED }}>{fNum(lost)}</b> closed lost ({((lost / Math.max(records.length, 1)) * 100).toFixed(1)}%)
        {blank > 0 && <> · {fNum(blank)} without a stage</>}
        {" "}· stages are current statuses, so each band is the population now at-or-beyond that step
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export function FootfallSection() {
  const [filters, setFilters] = useState<FfFilter[]>([]);
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);

  const rows = useMemo(() => ffScope(filters), [filters]);
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

  return (
    <div>
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
        <KPI l="Footfall" v={fNum(total)} s={`till ${FF.meta.asOn}`} />
        <KPI l="Direct" v={fNum(direct)} s={`${((direct / Math.max(total, 1)) * 100).toFixed(1)}% of visits`} />
        <KPI l="With CP" v={fNum(withCp)} s={`${((withCp / Math.max(total, 1)) * 100).toFixed(1)}% of visits`} />
        <KPI l="Projects visited" v={fNum(uProj)} s="unique projects/campaigns" />
        <KPI l="Avg / active day" v={perDay.toFixed(0)} s={`${fNum(activeDays)} active days`} />
        <KPI l="Booking conversion" v={bookedPct.toFixed(1) + "%"} s="of footfall booked" />
      </div>

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
            <HBarList items={listFrom(ffCount(rows, r => r.g), FF.G)} total={total} color={BLUE} onPick={(k, l) => addFilter("g", k, l)} />
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
              onPick={(k, l) => addFilter("src", k, l)}
            />
          </div>
        )}
        {!has("p") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall by project</h3>
            <div style={CAP}>top 10 · click → project</div>
            <HBarList items={listFrom(ffCount(rows, r => r.p), FF.P)} total={total} color={GOLD} onPick={(k, l) => addFilter("p", k, l)} />
          </div>
        )}
        {!has("loc") && (
          <div style={CARD}>
            <h3 style={H3}>Customer locality</h3>
            <div style={CAP}>top 10 · click → locality</div>
            <HBarList items={listFrom(ffCount(rows, r => r.loc), FF.LOC)} total={total} color={TEAL} onPick={(k, l) => addFilter("loc", k, l)} />
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
              onPick={(k, l) => addFilter("age", k, l)}
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
              onPick={(k, l) => addFilter("stg", k, l)}
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
            <TrendChart items={monthly} onPick={(k, l) => addFilter("mon", k, l)} />
          </div>
        )}
        {!has("dow") && (
          <div style={CARD}>
            <h3 style={H3}>Weekday pattern</h3>
            <div style={CAP}>visits by day of week · click a day</div>
            <WeekdayChart items={weekday} onPick={(k, l) => addFilter("dow", k, l)} />
          </div>
        )}
      </div>

      {/* Records table */}
      <div style={{ ...CARD, marginTop: 14, paddingBottom: 8 }}>
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
