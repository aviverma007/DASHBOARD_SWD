import pjRaw from "../../data/costProject.json";
import { createCostModule, type NpDataset } from "./NonProjectView";

/** Project cost tab — same dashboard, KPIs and drill drawer as Non-Project, fed by
 * the merged project export (scripts/build_cost_pj.py → costProject.json).
 *
 * Dimensions are re-labelled for projects:
 *   root  → Project       (CN41 project code + company)
 *   bh    → Segment       (level-2 WBS group: Trump Tower, Retail, Phase 4 …)
 *   pgrp  → Expense head  (Civil, MEP, Façade … spelling variants merged)
 *   comp  → Profit centre
 * Budget figures in the export are GST-inclusive and there are no basic-budget
 * columns, so this tab always shows With-GST values. There is no actual-postings
 * file, so the trend chart uses delivered PO value by PO month. */
export const PJM = createCostModule(pjRaw as unknown as NpDataset, {
  fyStart: "2023-01",
  dimNames: { root: "Project", bh: "Segment", pgrp: "Expense head", comp: "Profit centre" },
  drillTag: "PROJECT DRILL", allLabel: "All projects",
  nonPoNote: "non-PO postings net of reversals",
  hasPostings: false, poDim: "dtyp",
});
export const { NP: PJ, NP_ROWS: PJ_ROWS, npScope: pjScope, npAvail: pjAvail } = PJM;
export const ProjectView = PJM.View;
