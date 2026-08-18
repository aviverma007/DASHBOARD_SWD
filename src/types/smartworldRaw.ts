/**
 * Types for the raw Smartworld inventory dataset (RD object) exactly as
 * it exists in the reference tool. Field order and meaning match the
 * source verbatim — see the reference `U` array schema:
 *   [0] project index -> P[]
 *   [1] tower index -> TW[]
 *   [2] floor number (numeric)
 *   [3] floor label index -> FL[]
 *   [4] config index -> CFG[]
 *   [5] unit type index -> UT[]
 *   [6] total super area (sq ft)
 *   [7] total unit cost (INR)
 *   [8] status: 0 Available, 1 Booked, 2 Management
 *   [9] management sub-category (0 on hold / 1 in progress / 2 mgmt unit)
 *   [10] payment plan index -> PP[] (-1 if n/a)
 *   [11] rate band index -> RB[]
 *   [12] unit label
 */
export type RawUnit = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  0 | 1 | 2,
  number,
  number,
  number,
  string,
];

export interface RawInventoryDataset {
  P: string[];
  TW: string[];
  FL: string[];
  CFG: string[];
  UT: string[];
  PP: string[];
  RB: string[];
  U: RawUnit[];
  HY: Record<string, number>;
}

/** A scope condition, matching the reference tool's `scope` array items
 * exactly: {k, v, label}. `k` is the dimension key, `v` the value to
 * match, `label` the breadcrumb text. */
export interface ScopeCondition {
  k: "p" | "tw" | "fl" | "cfg" | "ut" | "st" | "cat" | "fb" | "sb" | "pb" | "rate";
  v: number;
  label: string;
}

export type StatusFilter = "all" | "av" | "bk" | "blk";

export interface FilterState {
  proj: Set<number>;
  status: StatusFilter;
  cat: number; // -1 = all
  cfg: number; // -1 = all
}
