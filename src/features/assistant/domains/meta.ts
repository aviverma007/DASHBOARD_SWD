/** Greeting, help, data-freshness. */
import { DATA_AS_ON } from "../../../config/dataInfo";
import type { Section } from "../types";
import { kv, rowsOf, text } from "./common";

export const EXAMPLES: [string, string][] = [
  ["Sales", "What were last month's sales for Sky Arc?"],
  ["Inventory", "How many units are unsold in The Edition?"],
  ["Target", "Target vs actual for this financial year"],
  ["Collections", "What is the net due in Trump Residences?"],
  ["Budget", "What is the budget and utilisation for One DXP?"],
  ["Pipeline", "How many PRs are pending at NFA approval?"],
  ["Customers", "How many open complaints do we have?"],
  ["Leads", "How many gallery visits did we get in September?"],
];

export function greeting(): Section {
  return {
    title: "SmartDB Assistant",
    headline: "Hi! Ask me anything about the dashboard data — sales, inventory, collections, budgets, PR to PO and more.",
    blocks: [
      text("I read the same datasets as the tabs, so my numbers match what you see on screen. I understand project names (Sky Arc, The Edition, Trump, Suites, Le Courtyard, One DXP…), periods (last month, September 2026, this FY, Q1) and follow-ups like “and its budget?”."),
      rowsOf(["Area", "Try asking"], EXAMPLES.map(([a, q]) => [a, q])),
    ],
  };
}

export async function freshness(): Promise<Section> {
  const [cp, ev, ff, dg, cv, eo, ln, tr, cs, cb, va] = await Promise.all([
    import("../../../data/cpAnalytics.json"), import("../../../data/smartworldInventory.json"), import("../../../data/footfallVisits.json"),
    import("../../../data/digitalEnquiries.json"), import("../../../data/cpGalleryVisits.json"), import("../../../data/eoiData.json"),
    import("../../../data/loanData.json"), import("../../../data/projectTracker.json"), import("../../../data/caseManagement.json"),
    import("../../../data/costBudget.json"), import("../../../data/vendorAgeing.json"),
  ]);
  const as = (m: unknown) => String((m as { default: { meta?: { asOn?: string } } }).default.meta?.asOn ?? "—");
  void ev;
  return {
    title: "Data freshness",
    headline: `Sales and inventory data is as on ${DATA_AS_ON}; other tabs have their own dates (below).`,
    blocks: [
      rowsOf(["Dataset", "As on"], [
        ["Bookings / PDRN, SAP Collection", as(cp)], ["Inventory (INVR)", DATA_AS_ON], ["Gallery footfall", as(ff)], ["Digital leads", as(dg)],
        ["CP gallery visits", as(cv)], ["EOI / Advance", as(eo)], ["Loan details", as(ln)], ["Project tracker", as(tr)],
        ["Case management (snapshot)", as(cs)], ["Cost / budget", as(cb)], ["Vendor ageing", as(va)], ["PR to PO", "Live from SAP / QMS"],
      ]),
      kv([["Relative dates", `“Last month”, “this month” etc. are read against ${DATA_AS_ON}, the date of the latest sales data.`]]),
    ],
  };
}
