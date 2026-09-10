import raw from "../../data/costMaster.json";

/** CN41 project-structure master (project + non-project trees, 09 Sep 2026).
 * N row: [0 code, 1 desc, 2 parentIdx (-1 = root), 3 level (1 = root),
 *         4 type (0 non-project | 1 project), 5 rootIdx, 6 level2GroupIdx] */
export interface CostMasterDataset {
  N: [string, string, number, number, number, number, number][];
  meta: { asOn: string; nodes: number; nonProject: number; project: number; roots: number };
}
export const CMASTER = raw as unknown as CostMasterDataset;

export interface MasterNode {
  i: number; code: string; desc: string; parent: number; level: number;
  /** 0 = non-project, 1 = project */ typ: number; root: number; group: number;
}
export const MASTER_NODES: MasterNode[] = CMASTER.N.map((r, i) => ({
  i, code: r[0], desc: r[1], parent: r[2], level: r[3], typ: r[4], root: r[5], group: r[6],
}));

/** code → node. A few codes exist twice (SAP project definition + its
 * top WBS share a code, e.g. RE/0113); the deeper WBS node wins, which
 * is the one transaction lines post against. */
export const NODE_BY_CODE: Map<string, MasterNode> = (() => {
  const m = new Map<string, MasterNode>();
  MASTER_NODES.forEach(n => {
    const cur = m.get(n.code);
    if (!cur || n.level > cur.level) m.set(n.code, n);
  });
  return m;
})();

/** Resolve a transaction WBS code to its master context (root project,
 * level-2 group, type). Falls back through parent codes by trimming
 * trailing "-xx" segments, so a leaf missing from the master still maps
 * to its nearest known ancestor. */
export function resolveWbs(code: string): { node: MasterNode | null; exact: boolean } {
  const direct = NODE_BY_CODE.get(code);
  if (direct) return { node: direct, exact: true };
  let c = code;
  while (c.includes("-")) {
    c = c.slice(0, c.lastIndexOf("-"));
    const hit = NODE_BY_CODE.get(c);
    if (hit) return { node: hit, exact: false };
  }
  return { node: null, exact: false };
}

export const rootOf = (n: MasterNode): MasterNode => MASTER_NODES[n.root];
export const groupOf = (n: MasterNode): MasterNode => MASTER_NODES[n.group];
