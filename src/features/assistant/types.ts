/** Shared types for the SmartDB assistant (built-in answer engine). */

export type Block =
  | { t: "kv"; rows: [string, string][] }
  | { t: "table"; head: string[]; rows: string[][]; note?: string }
  | { t: "bars"; title?: string; rows: { label: string; value: number; text: string }[] }
  | { t: "text"; text: string };

export interface Section {
  /** Short heading shown above the blocks, e.g. "Sales · Sep 2026". */
  title: string;
  /** One-line answer (goes on the orb card). */
  headline: string;
  blocks: Block[];
  /** "as on" stamp of the dataset behind this section. */
  asOn?: string;
  /** Deep link to the tab this came from. */
  open?: { label: string; path: string };
}

export interface Answer {
  headline: string;
  sections: Section[];
  followUps: string[];
  notes: string[];
}

export interface Entity {
  id: string;
  label: string;
  /** matches the user's wording */
  q: RegExp;
  /** matches a dataset's project/plant name (already normalised lower-case) */
  ds: RegExp;
}

export interface Period {
  kind: "all" | "range";
  label: string;
  /** user actually named a period */
  explicit: boolean;
  /** relative words like "last 7 days" need day-level data */
  dayLevel: boolean;
  from: Date;
  to: Date;
  /** inclusive list of "YYYY-MM" keys */
  months: string[];
  fromDay: number;
  toDay: number;
}

export interface Ctx {
  raw: string;
  nq: string;
  ents: Entity[];
  period: Period;
  /** second named month for "Sep vs Aug" style comparisons */
  period2?: Period;
  topN: number;
  /** question carried context over from the previous turn */
  carried: { ents: boolean; period: boolean };
  /** domain-agnostic cues */
  cue: {
    byProject: boolean; byMonth: boolean; byTower: boolean; byConfig: boolean; byYear: boolean;
    top: boolean; low: boolean; compare: boolean;
  };
}

export interface DomainDef {
  id: string;
  label: string;
  /** tabs that must be viewable for this domain (any one is enough) */
  paths: string[];
  tab: string;
  keywords: [RegExp, number][];
  run: (c: Ctx) => Promise<Section>;
}
