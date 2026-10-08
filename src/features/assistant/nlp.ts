/** Question understanding for the SmartDB assistant: project aliases,
 * time-period parsing, generic cues, and number formatting. Pure TS —
 * no dataset imports, so it stays in the small main chunk. */
import type { Ctx, Entity, Period } from "./types";
import { DATA_AS_ON } from "../../config/dataInfo";

/* ───────────────────────── formatting ───────────────────────── */
export const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
/** ₹ amount in Cr / L / plain. */
export const inr = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e7) return `${s}₹${(a / 1e7).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)} L`;
  return `${s}₹${Math.round(a).toLocaleString("en-IN")}`;
};
/** Value already in ₹ Cr. */
export const crv = (c: number) => `${c < 0 ? "-" : ""}₹${Math.abs(c).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
export const pct = (a: number, b: number, d = 1) => (b ? `${((a / b) * 100).toFixed(d)}%` : "—");
export const sqft = (a: number) => (a >= 1e5 ? `${(a / 1e5).toFixed(2)} L sq ft` : `${fN(a)} sq ft`);
export const delta = (cur: number, prev: number) => {
  if (!prev) return cur ? "new" : "—";
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}%`;
};

export const norm = (s: string) =>
  s.toLowerCase().replace(/[’`]/g, "'").replace(/[–—_/]/g, " ").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

/* ───────────────────────── dates ───────────────────────── */
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EPOCH_MS = new Date("2022-01-01T00:00:00").getTime();
export const dayNum = (d: Date) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - EPOCH_MS) / 86400000);
export const dayDate = (n: number) => new Date(EPOCH_MS + n * 86400000);
export const ymKey = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`;
export const ymOfDate = (d: Date) => ymKey(d.getFullYear(), d.getMonth());
export const ymLabel = (k: string) => { const [y, m] = k.split("-").map(Number); return `${MN[m - 1]} ${y}`; };
export const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const ANCHOR: Date = (() => {
  const m = DATA_AS_ON.match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/);
  if (!m) return new Date();
  return new Date(Number(m[3]), MN.findIndex(x => x.toLowerCase() === m[2].toLowerCase()), Number(m[1]));
})();

function monthsBetween(a: Date, b: Date): string[] {
  const out: string[] = [];
  let y = a.getFullYear(), m = a.getMonth();
  const ey = b.getFullYear(), em = b.getMonth();
  while (y < ey || (y === ey && m <= em)) { out.push(ymKey(y, m)); m++; if (m > 11) { m = 0; y++; } }
  return out;
}
const mkPeriod = (from: Date, to: Date, label: string, explicit = true, dayLevel = false): Period => ({
  kind: "range", label, explicit, dayLevel, from, to, months: monthsBetween(from, to), fromDay: dayNum(from), toDay: dayNum(to),
});
const monthStart = (y: number, m0: number) => new Date(y, m0, 1);
const monthEnd = (y: number, m0: number) => new Date(y, m0 + 1, 0);
const monthPeriod = (y: number, m0: number) => mkPeriod(monthStart(y, m0), monthEnd(y, m0), `${FULL[m0]} ${y}`);
const fyStartYear = (d: Date) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
const fyLabel = (sy: number) => `FY ${String(sy).slice(2)}-${String(sy + 1).slice(2)}`;

export function allTime(): Period {
  const from = new Date(2022, 0, 1);
  return { ...mkPeriod(from, ANCHOR, "All time (till date)", false), kind: "all" };
}

const MON_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const monIdx = (s: string) => MN.findIndex(x => x.toLowerCase() === s.slice(0, 3));

interface MonTok { m0: number; y: number | null; at: number }
function monthTokens(nq: string): MonTok[] {
  const out: MonTok[] = [];
  const re = new RegExp(`\\b${MON_RE}\\b(?:\\s*(?:'|,)?\\s*((?:20)?\\d{2})\\b)?`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(nq))) {
    const word = m[1];
    let y: number | null = null;
    if (m[2]) {
      const raw = m[2];
      if (raw.length === 4) y = Number(raw);
      else {
        const n = Number(raw), hasApos = /'/.test(m[0]);
        if (hasApos || (n >= 22 && n <= 29)) y = 2000 + n;
      }
    }
    if (word === "may") {
      const before = nq.slice(Math.max(0, m.index - 12), m.index);
      if (y === null && !/\b(in|of|for|during|on|till|since|from|to|and|between)\s*$/.test(before)) continue;
    }
    out.push({ m0: monIdx(word), y, at: m.index });
  }
  return out;
}
function resolveYear(m0: number, y: number | null): number {
  if (y) return y;
  // most recent occurrence not after the anchor
  return m0 <= ANCHOR.getMonth() ? ANCHOR.getFullYear() : ANCHOR.getFullYear() - 1;
}

/** "sep 2026 vs aug 2026" → [first, second] */
export function parseTwoMonths(nq: string): [Period, Period] | null {
  const toks = monthTokens(nq);
  if (toks.length < 2 || !/\b(vs|versus|compare\w*|against|with|and|than)\b/.test(nq) || /\b(from|between)\b|\bto\b|\btill\b|\buntil\b/.test(nq)) return null;
  const a = toks[0], b = toks[1];
  const ya = resolveYear(a.m0, a.y ?? b.y);
  const yb = resolveYear(b.m0, b.y ?? a.y);
  return [monthPeriod(ya, a.m0), monthPeriod(yb, b.m0)];
}

export function parsePeriod(nq: string): Period {
  const a = ANCHOR, ay = a.getFullYear(), am = a.getMonth();

  /* explicit month(s) */
  const toks = monthTokens(nq);
  if (toks.length >= 2 && /\b(from|between)\b|\bto\b|\btill\b|\buntil\b|\bthrough\b/.test(nq)) {
    const t1 = toks[0], t2 = toks[1];
    const y2 = resolveYear(t2.m0, t2.y);
    let y1 = t1.y ?? y2;
    if (!t1.y && t1.m0 > t2.m0) y1 = y2 - 1;
    const from = monthStart(y1, t1.m0), to = monthEnd(y2, t2.m0);
    if (from <= to) return mkPeriod(from, to, `${MN[t1.m0]} ${y1} – ${MN[t2.m0]} ${y2}`);
  }
  if (toks.length >= 1) {
    const t = toks[0];
    const y = resolveYear(t.m0, t.y);
    return monthPeriod(y, t.m0);
  }

  /* financial year / quarter */
  const fyM = nq.match(/\bfy\s*(?:20)?(\d{2})(?:\s*[- ]\s*(?:20)?(\d{2}))?\b|\bfinancial year\s*(?:20)?(\d{2})(?:\s*[- ]\s*(?:20)?(\d{2}))?\b/);
  const qM = nq.match(/\bq([1-4])\b/);
  if (qM) {
    let sy = fyStartYear(a);
    if (fyM) sy = 2000 + Number(fyM[1] ?? fyM[3]);
    const q = Number(qM[1]);
    const from = monthStart(sy, 3 + (q - 1) * 3), to = monthEnd(sy, 3 + (q - 1) * 3 + 2);
    return mkPeriod(from, to, `Q${q} ${fyLabel(sy)}`);
  }
  if (fyM) {
    const sy = 2000 + Number(fyM[1] ?? fyM[3]);
    return mkPeriod(monthStart(sy, 3), monthEnd(sy + 1, 2), fyLabel(sy));
  }
  if (/\b(this|current) (fy|financial year)\b|\bfytd\b/.test(nq)) {
    const sy = fyStartYear(a);
    return mkPeriod(monthStart(sy, 3), a, `${fyLabel(sy)} till date`);
  }
  if (/\b(last|previous|prev) (fy|financial year)\b/.test(nq)) {
    const sy = fyStartYear(a) - 1;
    return mkPeriod(monthStart(sy, 3), monthEnd(sy + 1, 2), fyLabel(sy));
  }
  if (/\b(last|previous|prev) quarter\b/.test(nq) || /\b(this|current) quarter\b/.test(nq)) {
    const sy = fyStartYear(a);
    const curQ = Math.floor(((am - 3 + 12) % 12) / 3); // 0..3 within FY
    const last = /\b(last|previous|prev)\b/.test(nq);
    let q = last ? curQ - 1 : curQ, y = sy;
    if (q < 0) { q = 3; y = sy - 1; }
    const from = monthStart(y, 3 + q * 3), to = last ? monthEnd(y, 3 + q * 3 + 2) : a;
    return mkPeriod(from, to, `Q${q + 1} ${fyLabel(y)}${last ? "" : " till date"}`);
  }

  /* relative days / weeks */
  if (/\btoday\b/.test(nq)) return mkPeriod(a, a, `Today (${fmtDate(a)})`, true, true);
  if (/\byesterday\b/.test(nq)) { const d = new Date(ay, am, a.getDate() - 1); return mkPeriod(d, d, `Yesterday (${fmtDate(d)})`, true, true); }
  const nd = nq.match(/\b(?:last|past|previous)\s+(\d{1,3})\s*(day|days|week|weeks)\b/);
  if (nd) {
    const n = Number(nd[1]) * (nd[2].startsWith("week") ? 7 : 1);
    const from = new Date(ay, am, a.getDate() - n + 1);
    return mkPeriod(from, a, `Last ${nd[1]} ${nd[2]}`, true, true);
  }
  if (/\bthis week\b/.test(nq)) {
    const dow = (a.getDay() + 6) % 7; const from = new Date(ay, am, a.getDate() - dow);
    return mkPeriod(from, a, "This week", true, true);
  }
  if (/\b(last|previous) week\b/.test(nq)) {
    const dow = (a.getDay() + 6) % 7; const to = new Date(ay, am, a.getDate() - dow - 1); const from = new Date(ay, am, to.getDate() - 6);
    return mkPeriod(from, to, "Last week", true, true);
  }

  /* relative months */
  const nm = nq.match(/\b(?:last|past|previous)\s+(\d{1,2})\s*months?\b/);
  if (nm) {
    const n = Number(nm[1]);
    const from = monthStart(ay, am - n), to = monthEnd(ay, am - 1);
    return mkPeriod(from, to, `Last ${n} months (${MN[from.getMonth()]} ${from.getFullYear()} – ${MN[to.getMonth()]} ${to.getFullYear()})`);
  }
  if (/\b(last|previous|prev|past) month\b/.test(nq)) { const d = monthStart(ay, am - 1); return monthPeriod(d.getFullYear(), d.getMonth()); }
  if (/\b(this|current) month\b|\bmtd\b/.test(nq)) return mkPeriod(monthStart(ay, am), a, `${FULL[am]} ${ay} (month to date)`);

  /* years */
  if (/\b(last|previous|prev) year\b/.test(nq)) return mkPeriod(new Date(ay - 1, 0, 1), new Date(ay - 1, 11, 31), String(ay - 1));
  if (/\b(this|current) year\b|\bytd\b/.test(nq)) return mkPeriod(new Date(ay, 0, 1), a, `${ay} year to date`);
  const yM = nq.match(/\b(20[2-3]\d)\b/);
  if (yM) { const y = Number(yM[1]); return mkPeriod(new Date(y, 0, 1), new Date(y, 11, 31), String(y)); }

  return allTime();
}

/** The period immediately before `p`, same length. null for all-time. */
export function prevPeriod(p: Period): Period | null {
  if (p.kind === "all") return null;
  if (p.dayLevel) {
    const n = p.toDay - p.fromDay + 1;
    const to = dayDate(p.fromDay - 1), from = dayDate(p.fromDay - n);
    return mkPeriod(from, to, "previous period", true, true);
  }
  const n = p.months.length;
  const from = monthStart(p.from.getFullYear(), p.from.getMonth() - n);
  const to = monthEnd(p.from.getFullYear(), p.from.getMonth() - 1);
  return mkPeriod(from, to, `${MN[from.getMonth()]} ${from.getFullYear()}${n > 1 ? ` – ${MN[to.getMonth()]} ${to.getFullYear()}` : ""}`);
}

export const inPeriodYm = (p: Period, y: number, m1: number) => {
  if (p.kind === "all") return true;
  return p.months.includes(ymKey(y, m1 - 1));
};
export const inPeriodDay = (p: Period, day: number) => {
  if (day < 0) return false;
  if (p.kind === "all") return true;
  if (p.dayLevel) return day >= p.fromDay && day <= p.toDay;
  return day >= dayNum(monthStart(p.from.getFullYear(), p.from.getMonth())) && day <= p.toDay;
};

/* ───────────────────────── projects ───────────────────────── */
/** Order matters: specific names first; each match is removed from the
 * text so "dxp phase 2" is not also read as plain "dxp". */
export const ENTITIES: Entity[] = [
  { id: "trump", label: "Trump Residences Gurgaon", q: /\btrump(?: residen\w+)?(?: gurgaon)?\b/, ds: /trump/ },
  { id: "code67", label: "Code 67 Gurgaon", q: /\bcode ?67\b(?: gurgaon)?/, ds: /code ?67/ },
  { id: "orchardstreet", label: "Orchard Street", q: /\borchard street\b/, ds: /orchard street/ },
  { id: "orchard", label: "Orchard", q: /\borchard\b/, ds: /orchard/ },
  { id: "gems2", label: "Gems 2", q: /\bgems ?2\b/, ds: /gems ?2/ },
  { id: "gems", label: "Gems", q: /\bgems\b/, ds: /gems(?! ?2)/ },
  { id: "natures", label: "Nature's Court", q: /\bnature'?s? court\b/, ds: /nature'?s court/ },
  { id: "dxp2", label: "One DXP Phase-2", q: /\b(?:one )?dxp(?: sector ?113)? ?(?:phase|ph) ?-? ?2\b|\bdxp ?2\b|\bphase ?-? ?2\b/, ds: /dxp.*(?:phase|ph) ?-? ?2/ },
  { id: "dxpstreet", label: "One DXP Street", q: /\b(?:one )?dxp street\b/, ds: /dxp.*street/ },
  { id: "dxpselect", label: "One DXP Select", q: /\b(?:one )?dxp select\b/, ds: /dxp.*select/ },
  { id: "dxp1", label: "One DXP Phase-1", q: /\b(?:one )?dxp(?: sector ?113)? ?(?:phase|ph) ?-? ?1\b/, ds: /^(?:smartworld )?one dxp$|dxp.*(?:phase|ph) ?-? ?1/ },
  { id: "dxp", label: "One DXP (all phases)", q: /\b(?:one )?dxp\b/, ds: /dxp/ },
  { id: "skyarc", label: "Smartworld Sky Arc", q: /\bsky ?arc\b|\bsector ?69\b/, ds: /sky ?arc/ },
  { id: "edition", label: "Smartworld The Edition", q: /\b(?:the )?edition\b|\bsector ?66\b|\bsw ?66\b/, ds: /edition/ },
  { id: "courtyard", label: "Smartworld Le Courtyard", q: /\b(?:le )?courtyard\b/, ds: /courtyard/ },
  { id: "suites", label: "Smartworld Suites", q: /\b(?:elie saab )?suites?\b/, ds: /suites/ },
  { id: "residencies", label: "Smartworld Residencies (Elie Saab)", q: /\belie saab residen\w+\b|\bresidencies\b|\bresidences\b/, ds: /residencies|elie saab residences/ },
  { id: "gic", label: "GIC Lofts", q: /\bgic lofts?\b/, ds: /gic lofts?/ },
  { id: "bigbillion", label: "Big Billion", q: /\bbig billion\b/, ds: /big billion/ },
];

/** Project ids that can be recognised from a dataset's own name. */
export function entityOfName(name: string): Entity | null {
  const n = norm(name);
  for (const e of ENTITIES) if (e.ds.test(n)) return e;
  return null;
}

export function extractEntities(nq: string): Entity[] {
  let t = ` ${nq} `;
  const found: Entity[] = [];
  for (const e of ENTITIES) {
    const re = new RegExp(e.q.source, "g");
    if (re.test(t)) { found.push(e); t = t.replace(new RegExp(e.q.source, "g"), " "); }
  }
  // specific dxp variants make the generic one redundant
  if (found.some(e => e.id === "dxp") && found.some(e => ["dxp1", "dxp2", "dxpstreet", "dxpselect"].includes(e.id)))
    return found.filter(e => e.id !== "dxp");
  return found;
}

/** Indexes of `names` matching any entity; null when no entity given. */
export function idxsFor(names: string[], ents: Entity[]): Set<number> | null {
  if (!ents.length) return null;
  const out = new Set<number>();
  names.forEach((n, i) => { const x = norm(n); if (ents.some(e => e.ds.test(x))) out.add(i); });
  return out;
}
export const entLabel = (ents: Entity[]) => (ents.length ? ents.map(e => e.label).join(" + ") : "All projects");

/* ───────────────────────── cues + context ───────────────────────── */
export function buildCtx(raw: string, prev?: { ents: Entity[]; period: Period | null } | null): Ctx {
  const nq = norm(raw);
  let ents = extractEntities(nq);
  let period = parsePeriod(nq);
  const carried = { ents: false, period: false };
  const words = nq.split(" ").filter(Boolean).length;
  const follow = /\b(it|its|this|that|same|them|their|these|those)\b/.test(nq) || /^(and|also|what about|how about|ok|okay)\b/.test(nq) || words <= 5;
  if (!ents.length && prev?.ents.length && follow && /\b(it|its|this project|that project|this|that|same|them|their|these|those)\b|^(and|also|what about|how about)\b|\bfor (it|this|that)\b/.test(nq)) {
    ents = prev.ents; carried.ents = true;
  }
  if (!period.explicit && prev?.period?.explicit && follow && /\b(same|that|those|then|that time)\b|^(and|also|what about|how about)\b/.test(nq) && !/\b(till date|overall|total|all time)\b/.test(nq)) {
    period = prev.period; carried.period = true;
  }
  const topM = nq.match(/\btop (\d{1,2})\b/);
  const two = parseTwoMonths(nq);
  if (two) period = two[0];
  return {
    raw, nq, ents, period, carried, period2: two ? two[1] : undefined,
    topN: topM ? Math.min(20, Math.max(1, Number(topM[1]))) : 5,
    cue: {
      byProject: /\b(by|per|each|every|across|all|different|which)\s+projects?\b|project ?wise|\bprojects\b/.test(nq),
      byMonth: /month ?wise|monthly|per month|by month|each month|\btrend\b|month on month|\bmom\b/.test(nq),
      byTower: /\btowers?\b/.test(nq),
      byConfig: /\b(config\w*|bhk|typolog\w*|unit types?)\b/.test(nq),
      byYear: /year ?wise|yearly|by year|annual\w*|per year/.test(nq),
      top: /\b(top|highest|most|best|largest|biggest|max(?:imum)?|leading|peak|more)\b/.test(nq),
      low: /\b(lowest|least|worst|smallest|min(?:imum)?|weakest|fewest|less)\b/.test(nq),
      compare: /\b(vs|versus|compare|compared|comparison|against|difference|growth|change|increase|decrease)\b/.test(nq),
    },
  };
}

/** Period to compare against: the second named month, else the one before. */
export const comparePeriod = (c: Ctx): Period | null => c.period2 ?? prevPeriod(c.period);
