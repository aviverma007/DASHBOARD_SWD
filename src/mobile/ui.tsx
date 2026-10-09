/** SmartDB mobile component kit — one design system, composed differently per module. */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as Icons from "lucide-react";
import { Check, ChevronRight, ChevronsUpDown, Inbox, Search, SlidersHorizontal, TrendingDown, TrendingUp, X } from "lucide-react";
import "./mobile-ui.css";

/* ───────── measure width of a container (for crisp SVG charts) ───────── */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ───────── toast ───────── */
const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const t = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(""), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="m-toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export const Ico = ({ n, size = 22, sw = 2 }: { n: string; size?: number; sw?: number }) => {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>)[n] ?? Icons.Circle;
  return <C size={size} strokeWidth={sw} />;
};

/* ───────── cards ───────── */
export function Card({ children, onClick, style, className = "" }: { children: ReactNode; onClick?: () => void; style?: CSSProperties; className?: string }) {
  if (onClick) return <button type="button" className={`m-card tap ${className}`} onClick={onClick} style={style}>{children}</button>;
  return <div className={`m-card ${className}`} style={style}>{children}</div>;
}
export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <h3 className="m-ct">{title}</h3>
        {sub && <p className="m-cs">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="m-sec">
      <h2>{title}</h2>
      {action && <button type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function Trend({ v, suffix = "%", invert = false }: { v: number; suffix?: string; invert?: boolean }) {
  const up = v > 0.0001, dn = v < -0.0001;
  const good = invert ? dn : up;
  const cls = !up && !dn ? "flat" : good ? "up" : "dn";
  return (
    <span className={`m-trend ${cls}`}>
      {up ? <TrendingUp size={12} /> : dn ? <TrendingDown size={12} /> : null}
      {up ? "+" : ""}{v.toFixed(Math.abs(v) < 10 ? 1 : 0)}{suffix}
    </span>
  );
}

export function Hero({ label, value, sub, cells, trend, children }: {
  label: string; value: string; sub?: string; cells?: { v: string; l: string }[]; trend?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="m-hero m-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span className="m-label">{label}</span>{trend}
      </div>
      <div className="m-hero-v m-num">{value}</div>
      {sub && <div className="m-hero-s">{sub}</div>}
      {children}
      {cells && (
        <div className="m-hero-row">
          {cells.map(c => <div key={c.l}><b className="m-num">{c.v}</b><span>{c.l}</span></div>)}
        </div>
      )}
      <div className="m-gold-line" />
    </div>
  );
}

export function Kpi({ label, value, sub, color, onClick, accent }: { label: string; value: string; sub?: string; color?: string; onClick?: () => void; accent?: boolean }) {
  const st = { "--m-c": color } as CSSProperties;
  const inner = (
    <>
      <span className="m-label"><i />{label}</span>
      <b className="m-num">{value}</b>
      {sub && <small>{sub}</small>}
    </>
  );
  return onClick
    ? <button type="button" className={`m-kpi tap${accent ? " accent" : ""}`} style={st} onClick={onClick}>{inner}</button>
    : <div className={`m-kpi${accent ? " accent" : ""}`} style={st}>{inner}</div>;
}

export function Ring({ pct, size = 68, stroke = 9, color = "#1e3163", label }: { pct: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ width: size, height: size, position: "relative", flex: "0 0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9ecf4" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: size > 60 ? 16 : 12, letterSpacing: "-0.03em" }}>
        {label ?? `${Math.round(p)}%`}
      </div>
    </div>
  );
}

export function Insight({ label, value, sub, pct, color, onClick }: { label: string; value: string; sub?: string; pct: number; color?: string; onClick?: () => void }) {
  return (
    <Card onClick={onClick}>
      <div className="m-ins">
        <Ring pct={pct} color={color} />
        <div className="m-ins-t"><span className="m-label">{label}</span><b className="m-num">{value}</b>{sub && <small>{sub}</small>}</div>
        {onClick && <ChevronRight size={18} color="#9aa3b5" />}
      </div>
    </Card>
  );
}

export function Progress({ pct, color, lg }: { pct: number; color?: string; lg?: boolean }) {
  return <div className={`m-prog${lg ? " lg" : ""}`} style={{ "--m-c": color } as CSSProperties}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}
export function SegBar({ parts }: { parts: { v: number; c: string }[] }) {
  const t = parts.reduce((s, p) => s + p.v, 0) || 1;
  return <div className="m-seg-bar">{parts.map((p, i) => p.v > 0 && <i key={i} style={{ width: `${(p.v / t) * 100}%`, background: p.c }} />)}</div>;
}
export function Legend({ items }: { items: { l: string; c: string; v?: string }[] }) {
  return <div className="m-legend">{items.map(i => <span key={i.l}><i style={{ background: i.c }} />{i.l}{i.v ? ` · ${i.v}` : ""}</span>)}</div>;
}
export function Pill({ children, tone }: { children: ReactNode; tone?: "ok" | "bad" | "warn" | "gold" }) {
  return <span className={`m-pill ${tone ?? ""}`}>{children}</span>;
}

/* ───────── ranked horizontal bars ───────── */
export function HBars({ rows, color = "#1e3163", format }: { rows: { label: string; value: number; sub?: string; color?: string; onClick?: () => void }[]; color?: string; format: (n: number) => string }) {
  const mx = Math.max(...rows.map(r => r.value), 1);
  return (
    <div>
      {rows.map(r => (
        <div className="m-hbar" key={r.label} onClick={r.onClick} style={r.onClick ? { cursor: "pointer" } : undefined}>
          <div className="m-hbar-h"><span>{String(r.label ?? "").trim() || "Unassigned"}</span><span className="m-num">{format(r.value)}</span></div>
          <Progress pct={(r.value / mx) * 100} color={r.color ?? color} />
          {r.sub && <div style={{ fontSize: 11.5, color: "var(--m-mut)", marginTop: 4 }}>{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ───────── list ───────── */
export function List({ children }: { children: ReactNode }) { return <div className="m-card m-list" style={{ padding: "4px 0" }}>{children}</div>; }
export function Row({ icon, title, sub, value, valueSub, onClick, rank, right }: {
  icon?: ReactNode; title: string; sub?: string; value?: string; valueSub?: string; onClick?: () => void; rank?: number; right?: ReactNode;
}) {
  const body = (
    <>
      {rank !== undefined && <span className={`m-rank${rank === 1 ? " g1" : ""}`}>{rank}</span>}
      {icon && <span className="m-row-i">{icon}</span>}
      <span className="m-row-t"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {value && <span className="m-row-v"><b className="m-num">{value}</b>{valueSub && <small>{valueSub}</small>}</span>}
      {right}
      {onClick && !right && <ChevronRight size={17} color="#a5acbd" />}
    </>
  );
  return onClick ? <button type="button" className="m-row" onClick={onClick}>{body}</button> : <div className="m-row">{body}</div>;
}

/* ───────── chips, segmented control, search ───────── */
export function Chips({ children }: { children: ReactNode }) { return <div className="m-chips">{children}</div>; }
export function Chip({ children, on, set, onClick, icon }: { children: ReactNode; on?: boolean; set?: boolean; onClick?: () => void; icon?: ReactNode }) {
  return <button type="button" className={`m-chip${on ? " on" : ""}${set ? " set" : ""}`} onClick={onClick}>{icon}{children}</button>;
}
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { k: T; l: string }[]; onChange: (k: T) => void }) {
  return <div className="m-seg" role="tablist">{options.map(o => <button key={o.k} type="button" role="tab" aria-selected={value === o.k} className={value === o.k ? "on" : ""} onClick={() => onChange(o.k)}>{o.l}</button>)}</div>;
}
export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="m-search">
      <Search size={18} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type="search" enterKeyHint="search" />
      {value && <button type="button" className="m-ico" style={{ width: 28, height: 28 }} onClick={() => onChange("")} aria-label="Clear"><X size={16} /></button>}
    </label>
  );
}

/* ───────── bottom sheet (closes on Android back) ───────── */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (!open) return;
    history.pushState({ sheet: true }, "");
    pushed.current = true;
    const pop = () => { pushed.current = false; onClose(); };
    window.addEventListener("popstate", pop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", pop);
      document.body.style.overflow = prev;
      if (pushed.current) { pushed.current = false; history.back(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="m-scrim" onClick={onClose} />
      <div className="m-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="m-grab" />
        <div className="m-sheet-h"><h3>{title}</h3><button type="button" className="m-ico" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="m-sheet-b">{children}</div>
        {footer && <div className="m-sheet-f">{footer}</div>}
      </div>
    </>
  );
}

/* ───────── filter bar: chips on top + a bottom sheet with the full form ───────── */
export interface FilterField { key: string; label: string; options: { k: string; l: string }[]; allLabel?: string; searchable?: boolean }
export type FilterValues = Record<string, string>;

export function FilterBar({ fields, values, onApply, quick }: { fields: FilterField[]; values: FilterValues; onApply: (v: FilterValues) => void; quick?: string[] }) {
  const [sheet, setSheet] = useState(false);
  const [one, setOne] = useState<FilterField | null>(null);
  const [draft, setDraft] = useState<FilterValues>(values);
  useEffect(() => { if (!sheet) setDraft(values); }, [values, sheet]);
  const labelOf = (f: FilterField, v: string) => (v ? f.options.find(o => o.k === v)?.l ?? v : f.allLabel ?? `All ${f.label.toLowerCase()}`);
  const active = fields.filter(f => values[f.key]).length;
  const chipsFor = quick ? fields.filter(f => quick.includes(f.key)) : fields.slice(0, 2);
  return (
    <>
      <Chips>
        {chipsFor.map(f => (
          <Chip key={f.key} set={!!values[f.key]} onClick={() => setOne(f)} icon={null}>
            {labelOf(f, values[f.key])}<ChevronsUpDown size={14} className="m-x" />
          </Chip>
        ))}
        <Chip on={active > 0} onClick={() => setSheet(true)} icon={<SlidersHorizontal size={15} />}>Filters{active ? ` · ${active}` : ""}</Chip>
        {active > 0 && <Chip onClick={() => onApply({})} icon={<X size={14} />}>Reset</Chip>}
      </Chips>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters"
        footer={<><button type="button" className="m-btn" onClick={() => { setDraft({}); onApply({}); setSheet(false); }}>Reset</button>
          <button type="button" className="m-btn pri" onClick={() => { onApply(draft); setSheet(false); }}>Apply</button></>}>
        {fields.map(f => (
          <div className="m-field" key={f.key}>
            <span className="m-label">{f.label}</span>
            <Chips>
              <Chip on={!draft[f.key]} onClick={() => setDraft(d => ({ ...d, [f.key]: "" }))}>{f.allLabel ?? "All"}</Chip>
              {f.options.length <= 6
                ? f.options.map(o => <Chip key={o.k} on={draft[f.key] === o.k} onClick={() => setDraft(d => ({ ...d, [f.key]: o.k }))}>{o.l}</Chip>)
                : <Chip on={!!draft[f.key]} onClick={() => { setSheet(false); setTimeout(() => setOne(f), 60); }}>{draft[f.key] ? labelOf(f, draft[f.key]) : `Choose ${f.label.toLowerCase()}…`}</Chip>}
            </Chips>
          </div>
        ))}
      </Sheet>

      <Picker field={one} value={one ? values[one.key] ?? "" : ""} onClose={() => setOne(null)} onPick={k => { if (one) onApply({ ...values, [one.key]: k }); setOne(null); }} />
    </>
  );
}

function Picker({ field, value, onClose, onPick }: { field: FilterField | null; value: string; onClose: () => void; onPick: (k: string) => void }) {
  const [q, setQ] = useState("");
  useEffect(() => { setQ(""); }, [field]);
  const opts = useMemo(() => (field ? field.options.filter(o => o.l.toLowerCase().includes(q.toLowerCase())) : []), [field, q]);
  return (
    <Sheet open={!!field} onClose={onClose} title={field?.label ?? ""}>
      {field && field.options.length > 7 && <div style={{ marginBottom: 8 }}><SearchBar value={q} onChange={setQ} placeholder={`Search ${field.label.toLowerCase()}`} /></div>}
      <button type="button" className={`m-opt${!value ? " on" : ""}`} onClick={() => onPick("")}>{field?.allLabel ?? "All"}<span className="m-check">{!value && <Check size={14} />}</span></button>
      {opts.map(o => (
        <button key={o.k} type="button" className={`m-opt${value === o.k ? " on" : ""}`} onClick={() => onPick(o.k)}>{o.l}<span className="m-check">{value === o.k && <Check size={14} />}</span></button>
      ))}
      {!opts.length && <Empty title="No matches" sub="Try a different spelling." />}
    </Sheet>
  );
}

/* ───────── states ───────── */
export function Empty({ title, sub, icon }: { title: string; sub?: string; icon?: ReactNode }) {
  return <div className="m-empty"><div className="ic">{icon ?? <Inbox size={26} />}</div><b>{title}</b>{sub}</div>;
}
export function Skel({ h = 90, style }: { h?: number; style?: CSSProperties }) { return <div className="m-skel" style={{ height: h, ...style }} />; }
export function ScreenSkeleton() {
  return <div className="m-stack"><Skel h={150} style={{ borderRadius: 20 }} /><div className="m-grid2"><Skel h={84} /><Skel h={84} /></div><Skel h={200} /><Skel h={120} /></div>;
}

/* ───────── charts ───────── */
const NAVY = "#1e3163", GOLD = "#b8893c";

export function BarChart({ data, format, height = 176, color = NAVY, accent = GOLD, unit }: {
  data: { label: string; value: number }[]; format: (n: number) => string; height?: number; color?: string; accent?: string; unit?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState(data.length - 1);
  useEffect(() => { setSel(data.length - 1); }, [data.length]);
  const W = Math.max(w, 200), H = height, mt = 8, mb = 24;
  const mx = Math.max(...data.map(d => d.value), 1);
  const band = W / Math.max(data.length, 1);
  const bw = Math.min(30, band * 0.58);
  const step = Math.max(1, Math.ceil(data.length / Math.max(3, Math.floor(W / 44))));
  const cur = data[sel];
  return (
    <div ref={ref}>
      <div className="m-callout"><b className="m-num">{cur ? format(cur.value) : "—"}</b><span>{cur?.label}{unit ? ` · ${unit}` : ""}</span></div>
      {w > 0 && (
        <svg className="m-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img">
          {[0.5, 1].map(f => <line key={f} x1={0} x2={W} y1={mt + (H - mt - mb) * (1 - f)} y2={mt + (H - mt - mb) * (1 - f)} stroke="#e9ecf4" strokeDasharray="3 4" />)}
          {data.map((d, i) => {
            const bh = Math.max(3, ((H - mt - mb) * d.value) / mx);
            const x = i * band + (band - bw) / 2, y = H - mb - bh;
            return (
              <g key={d.label + i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                <rect x={i * band} y={0} width={band} height={H} fill="transparent" />
                <rect x={x} y={y} width={bw} height={bh} rx={Math.min(8, bw / 2)} fill={i === sel ? accent : color} opacity={i === sel ? 1 : 0.85} style={{ transition: "fill .2s" }} />
                {(i % step === 0 || i === data.length - 1) && <text x={i * band + band / 2} y={H - 7} textAnchor="middle" fontSize={10.5} fontWeight={i === sel ? 800 : 600} fill={i === sel ? "#14213d" : "#8a92a6"}>{d.label}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function AreaChart({ data, format, height = 150, color = NAVY, unit }: {
  data: { label: string; value: number }[]; format: (n: number) => string; height?: number; color?: string; unit?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState(data.length - 1);
  useEffect(() => { setSel(data.length - 1); }, [data.length]);
  const W = Math.max(w, 200), H = height, mt = 10, mb = 22, ml = 6, mr = 6;
  const mx = Math.max(...data.map(d => d.value), 1);
  const n = Math.max(data.length - 1, 1);
  const px = (i: number) => ml + ((W - ml - mr) * i) / n;
  const py = (v: number) => mt + (H - mt - mb) * (1 - v / mx);
  const pts = data.map((d, i) => [px(i), py(d.value)] as const);
  const line = pts.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px0, py0] = pts[i - 1], cx = (px0 + x) / 2;
    return `C${cx},${py0} ${cx},${y} ${x},${y}`;
  }).join(" ");
  const area = `${line} L${px(data.length - 1)},${H - mb} L${px(0)},${H - mb} Z`;
  const gid = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);
  const step = Math.max(1, Math.ceil(data.length / Math.max(3, Math.floor(W / 52))));
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - ml) / (W - ml - mr)) * n);
    setSel(Math.max(0, Math.min(data.length - 1, i)));
  };
  const cur = data[sel];
  return (
    <div ref={ref}>
      <div className="m-callout"><b className="m-num">{cur ? format(cur.value) : "—"}</b><span>{cur?.label}{unit ? ` · ${unit}` : ""}</span></div>
      {w > 0 && data.length > 0 && (
        <svg className="m-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} onPointerDown={move} onPointerMove={e => e.buttons === 1 || e.pointerType === "touch" ? move(e) : undefined} style={{ touchAction: "pan-y" }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {[0.5, 1].map(f => <line key={f} x1={0} x2={W} y1={mt + (H - mt - mb) * (1 - f)} y2={mt + (H - mt - mb) * (1 - f)} stroke="#e9ecf4" strokeDasharray="3 4" />)}
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {pts[sel] && <>
            <line x1={pts[sel][0]} x2={pts[sel][0]} y1={mt} y2={H - mb} stroke={GOLD} strokeDasharray="3 3" />
            <circle cx={pts[sel][0]} cy={pts[sel][1]} r={6} fill="#fff" stroke={GOLD} strokeWidth={3} />
          </>}
          {data.map((d, i) => (i % step === 0 || i === data.length - 1) && <text key={i} x={Math.min(W - 14, Math.max(14, px(i)))} y={H - 6} textAnchor="middle" fontSize={10.5} fontWeight={i === sel ? 800 : 600} fill={i === sel ? "#14213d" : "#8a92a6"}>{d.label}</text>)}
        </svg>
      )}
    </div>
  );
}

export function Sparkline({ values, color = "#fff", height = 40 }: { values: number[]; color?: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const W = Math.max(w, 80), mx = Math.max(...values, 1), mn = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(W * i) / Math.max(values.length - 1, 1)},${height - 4 - ((height - 8) * (v - mn)) / Math.max(mx - mn, 1)}`);
  return (
    <div ref={ref} style={{ marginTop: 10 }}>
      {w > 0 && values.length > 1 && (
        <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} style={{ display: "block" }}>
          <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
          <circle cx={W} cy={Number(pts[pts.length - 1].split(",")[1])} r={4} fill="#d6ac5e" />
        </svg>
      )}
    </div>
  );
}

export function Donut({ slices, center, size = 148 }: { slices: { label: string; value: number; color: string }[]; center: { v: string; l: string }; size?: number }) {
  const tot = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 12, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ width: size, height: size, position: "relative", margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f8" strokeWidth={20} />
        {slices.filter(s => s.value > 0).map(s => {
          const len = (s.value / tot) * c, off = acc;
          acc += len;
          return <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={20}
            strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-off} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div><b className="m-num" style={{ fontSize: 22, fontWeight: 800, display: "block", lineHeight: 1.1 }}>{center.v}</b><span style={{ fontSize: 11, color: "var(--m-mut)", fontWeight: 600 }}>{center.l}</span></div>
      </div>
    </div>
  );
}

export function Funnel({ stages, colors }: { stages: { label: string; value: number; sub?: string }[]; colors?: string[] }) {
  const mx = Math.max(...stages.map(s => s.value), 1);
  const cols = colors ?? ["#1e3163", "#2a4488", "#0e7490", "#16a06f", "#b8893c"];
  return (
    <div className="m-funnel">
      {stages.map((s, i) => (
        <div key={s.label} style={{ width: `${Math.max(46, (s.value / mx) * 100)}%`, background: cols[i % cols.length] }}>
          <span>{s.label}</span><em className="m-num">{s.sub ?? s.value.toLocaleString("en-IN")}</em>
        </div>
      ))}
    </div>
  );
}

/* ───────── "open the full desktop view" affordance ───────── */
export function FullViewLink({ onClick, label = "Open full detailed view" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="m-btn" onClick={onClick}>{label}<ChevronRight size={18} /></button>;
}
