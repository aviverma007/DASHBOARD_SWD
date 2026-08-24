import footfallRaw from "../data/leadFootfall.json";
import cpVisitsRaw from "../data/leadCpVisits.json";
import digitalRaw from "../data/leadDigital.json";

// ── Footfall ─────────────────────────────────────────────────────────────
interface FootfallRaw {
  PROJ: string[]; CP: string[]; SOURCE: string[]; STAGE: string[]; LOCALITY: string[];
  AGE: string[]; CATEGORY: string[]; GALLERY: string[]; R: (string | number)[][]; sourceNote: string;
}
const FR = footfallRaw as unknown as FootfallRaw;

export interface FootfallRecord {
  project: string; name: string; cp: string; source: string; stage: string;
  locality: string; age: string; category: string; oppNo: string;
  createdYear: number; createdMonth: number; visitYear: number; visitMonth: number; gallery: string;
}

function toFootfallRecord(r: (string | number)[]): FootfallRecord {
  return {
    project: FR.PROJ[r[0] as number], cp: FR.CP[r[1] as number], source: FR.SOURCE[r[2] as number],
    stage: FR.STAGE[r[3] as number], locality: FR.LOCALITY[r[4] as number], age: FR.AGE[r[5] as number],
    category: FR.CATEGORY[r[6] as number], createdYear: r[7] as number, createdMonth: r[8] as number,
    visitYear: r[9] as number, visitMonth: r[10] as number, gallery: FR.GALLERY[r[11] as number],
    name: r[12] as string, oppNo: r[13] as string,
  };
}

export const FOOTFALL: { records: FootfallRecord[]; sourceNote: string } = {
  records: FR.R.map(toFootfallRecord),
  sourceNote: FR.sourceNote,
};

// This file is a SITE VISIT LOG — virtually every record has a real visit
// date (27,469 of 27,528, ~99.8%), so "Total Footfall" and "Site Visit"
// represent the same population, not two different funnel depths. "New"
// (a walk-in that just happened) is the same event too. All three are
// shown as the funnel's flat top rung at the full total.
//
// From there, "Stage" tracks each opportunity's CURRENT standing — most
// sit at "Site Visit" (no further movement yet); the ones that genuinely
// progressed further show up as Submitted to CRM / In Progress /
// Inventory / Booked. Those four are cumulative (an opportunity currently
// at Booked obviously also passed through In Progress), while Closed Lost
// is a separate drop-off count since its earlier depth isn't recorded.
export const FOOTFALL_PROGRESS_LADDER = ["Submitted to CRM", "In Progress", "Inventory", "Booked"];
export const FOOTFALL_LADDER = ["New", "Site Visit", ...FOOTFALL_PROGRESS_LADDER];

export function footfallFunnel(records: FootfallRecord[]) {
  const total = records.length;
  const rank = (s: string) => FOOTFALL_PROGRESS_LADDER.indexOf(s);
  const closedLost = records.filter(r => r.stage === "Closed Lost").length;
  const unstaged = records.filter(r => r.stage === "Unstaged").length;

  const progressCumulative = FOOTFALL_PROGRESS_LADDER.map((stage, i) => ({
    stage,
    count: records.filter(r => rank(r.stage) >= i).length,
  }));

  const cumulative = [
    { stage: "New", count: total },
    { stage: "Site Visit", count: total },
    ...progressCumulative,
  ];

  return { total, cumulative, closedLost, unstaged };
}

// ── CP Visits ────────────────────────────────────────────────────────────
interface CpVisitsRawShape {
  PROJ: string[]; CP: string[]; STATUS: string[]; SUBJECT: string[]; VTYPE: string[]; GALLERY: string[];
  R: (string | number)[][]; sourceNote: string;
}
const CVR = cpVisitsRaw as unknown as CpVisitsRawShape;

export interface CpVisitRecord {
  project: string; cp: string; name: string; status: string; subject: string;
  visitType: string; visitors: number; gallery: string; year: number; month: number;
}

function toCpVisitRecord(r: (string | number)[]): CpVisitRecord {
  return {
    project: CVR.PROJ[r[0] as number], cp: CVR.CP[r[1] as number], status: CVR.STATUS[r[2] as number],
    subject: CVR.SUBJECT[r[3] as number], visitType: CVR.VTYPE[r[4] as number], visitors: r[5] as number,
    gallery: CVR.GALLERY[r[6] as number], year: r[7] as number, month: r[8] as number, name: r[9] as string,
  };
}

export const CP_VISITS: { records: CpVisitRecord[]; sourceNote: string } = {
  records: CVR.R.map(toCpVisitRecord),
  sourceNote: CVR.sourceNote,
};

// No booking-outcome field exists in this source — the deepest real signal
// is visit-logistics status. This funnel intentionally stops at "Completed"
// rather than fabricating a conversion-to-booking stage.
export const CP_VISIT_LADDER = ["Scheduled", "In Progress", "Completed"];

export function cpVisitFunnel(records: CpVisitRecord[]) {
  const rank = (s: string) => CP_VISIT_LADDER.indexOf(s);
  const staged = records.filter(r => rank(r.status) >= 0);
  const other = records.filter(r => rank(r.status) < 0).length; // "Open" / "Unknown"

  const cumulative = CP_VISIT_LADDER.map((stage) => ({
    stage,
    count: staged.filter(r => r.status === stage).length,
  }));

  return { total: records.length, cumulative, other };
}

// ── Digital Leads ────────────────────────────────────────────────────────
interface DigitalRawShape {
  PROJ: string[]; STATUS: string[]; STAGE: string[]; SUBSRC: string[]; UTM: string[]; AGENCY: string[];
  R: number[][]; sourceNote: string;
}
const DR = digitalRaw as unknown as DigitalRawShape;

export interface DigitalRecord {
  project: string; status: string; stage: string; subSource: string;
  utmSource: string; agencySource: string; year: number; month: number;
}

function toDigitalRecord(r: number[]): DigitalRecord {
  return {
    project: DR.PROJ[r[0]], status: DR.STATUS[r[1]], stage: DR.STAGE[r[2]], subSource: DR.SUBSRC[r[3]],
    utmSource: DR.UTM[r[4]], agencySource: DR.AGENCY[r[5]], year: r[6], month: r[7],
  };
}

export const DIGITAL: { records: DigitalRecord[]; sourceNote: string } = {
  records: DR.R.map(toDigitalRecord),
  sourceNote: DR.sourceNote,
};

export const DIGITAL_LADDER = ["New", "In Progress", "Site Visit", "Inventory", "Booked"];

export function digitalFunnel(records: DigitalRecord[]) {
  const rank = (s: string) => DIGITAL_LADDER.indexOf(s);
  const qualified = records.filter(r => r.status === "Qualified" || r.status === "In Progress" || r.status === "Site Visit Scheduled").length;
  const staged = records.filter(r => rank(r.stage) >= 0);
  const closedLost = records.filter(r => r.stage === "Closed Lost").length;
  const notQualified = records.filter(r => r.status === "Not Qualified").length;

  const cumulative = DIGITAL_LADDER.map((stage, i) => ({
    stage,
    count: staged.filter(r => rank(r.stage) >= i).length,
  }));

  return { total: records.length, qualified, cumulative, closedLost, notQualified };
}

// Full stage-wise bifurcation, scoped to one Status value at a time — shows
// EVERY Stage value present (New / In Progress / Site Visit / Inventory /
// Booked / Closed Lost / Unstaged) as its own raw count, so nothing is
// folded away or hidden. Two separate funnels use this: one for
// Status="New" leads, one for Status="Qualified" leads, answering
// "after landing in this status, where did they actually end up?"
export const DIGITAL_ALL_STAGES = ["New", "In Progress", "Site Visit", "Inventory", "Booked", "Closed Lost", "Unstaged"];

export function digitalStatusBifurcation(records: DigitalRecord[], status: string) {
  const scoped = records.filter(r => r.status === status);
  const cumulative = DIGITAL_ALL_STAGES.map(stage => ({
    stage,
    count: scoped.filter(r => r.stage === stage).length,
  }));
  return { total: scoped.length, cumulative, records: scoped };
}

// The other, non-Qualified Status buckets — a simple count per Status
// value, in a fixed display order (not sorted by size), plus an explicit
// "no status recorded" bucket for full transparency even if it's empty.
export const DIGITAL_OTHER_STATUSES = ["New", "In Progress", "Site Visit Scheduled", "Not Qualified"];

export function digitalOtherStatusCounts(records: DigitalRecord[]) {
  const known = new Set([...DIGITAL_OTHER_STATUSES, "Qualified"]);
  const rows = DIGITAL_OTHER_STATUSES.map(status => ({
    status,
    count: records.filter(r => r.status === status).length,
  }));
  const others = records.filter(r => !known.has(r.status)).length;
  rows.push({ status: "Others (no status)", count: others });
  return rows;
}

// ── Shared breakdown helpers ─────────────────────────────────────────────

export interface BreakdownRow { key: string; count: number; pct: number }

export function breakdownBy<T>(records: T[], keyFn: (r: T) => string, topN = 12): BreakdownRow[] {
  const map = new Map<string, number>();
  records.forEach(r => {
    const k = keyFn(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  const total = records.length || 1;
  return [...map.entries()]
    .map(([key, count]) => ({ key, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// Age buckets need natural numeric ordering, not count-sorted
const AGE_ORDER = ["20-25", "25-30", "30-35", "35-40", "40-45", "45-50", "50-55", "55-60", "Greater Than 60", "Unknown"];
export function ageBreakdown(records: FootfallRecord[]): BreakdownRow[] {
  const map = new Map<string, number>();
  records.forEach(r => map.set(r.age, (map.get(r.age) ?? 0) + 1));
  const total = records.length || 1;
  return AGE_ORDER.filter(a => map.has(a)).map(key => ({ key, count: map.get(key)!, pct: Math.round((map.get(key)! / total) * 100) }));
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(year: number, month: number): string {
  if (!year || !month) return "Unknown";
  return `${MONTHS[month]}'${String(year).slice(2)}`;
}
