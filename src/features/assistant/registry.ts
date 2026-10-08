/** Domain registry: keyword scoring + lazy loaders. Heavy datasets only
 * load when a question actually needs them. */
import type { DomainDef } from "./types";

export const DOMAINS: DomainDef[] = [
  {
    id: "sales", label: "Sales", tab: "Bookings", paths: ["/bookings", "/overview"],
    keywords: [[/\b(sales?|sell|selling|sold|bookings?|tsv|revenue|sale value|cancell\w+|rebook\w*|units sold|turnover|business done)\b/, 3], [/\b(avg|average) ?(rate|psf|price)\b|\bprice per\b|per sq ?ft|\brate per\b/, 3], [/\bbooked\b/, 1]],
    run: c => import("./domains/sales").then(m => m.runSales(c)),
  },
  {
    id: "cp", label: "Channel partners", tab: "Channel Partners", paths: ["/channel-partners"],
    keywords: [[/\b(channel partners?|cps?|brokers?|brokerage partners?|partners?)\b/, 3], [/\b(top|best|which) (cp|channel partner|broker)/, 2]],
    run: c => import("./domains/sales").then(m => m.runCp(c)),
  },
  {
    id: "inventory", label: "Inventory", tab: "Inventory", paths: ["/inventory", "/overview"],
    keywords: [[/\b(inventory|unsold|available|stock|vacant|remaining|left to sell|total units|how many units|sellable|sold out|sold percent\w*|sold %|unit [a-z]{1,3}\d{0,2} ?-? ?\d{2,4})\b/, 4], [/\b(units?|flats?|apartments?)\b/, 1], [/\btotal (area|units)\b|\bsuper area\b/, 4]],
    run: c => import("./domains/inventory").then(m => m.runInventory(c)),
  },
  {
    id: "target", label: "Target vs actual", tab: "Target vs Actual", paths: ["/target"],
    keywords: [[/\b(targets?|achievement|achieved|shortfall|aop|against target|vs target|target vs actual|short of)\b/, 5]],
    run: c => import("./domains/target").then(m => m.runTarget(c)),
  },
  {
    id: "collections", label: "SAP collection", tab: "SAP Collection", paths: ["/sap-collections"],
    keywords: [[/\b(collections?|collected|received|receivables?|demand\w*|called|outstanding|net due|future dues?|tcv|contract value|due from customers?|customer dues?|dues|owe us|owes us|owing|to collect|pending payments?)\b/, 4]],
    run: c => import("./domains/collections").then(m => m.runCollections(c)),
  },
  {
    id: "eoi", label: "EOI / Advance", tab: "EOI/Advance", paths: ["/eoi"],
    keywords: [[/\b(eoi|eois|expression of interest|advance money|advance receipts?|token money|allotment pending)\b/, 5]],
    run: c => import("./domains/eoi").then(m => m.runEoi(c)),
  },
  {
    id: "footfall", label: "Gallery footfall", tab: "Gallery Footfall", paths: ["/gallery-footfall"],
    keywords: [[/\b(footfall|foot fall|walk ?-?ins?|customer visits?|site visits?|gallery visits?|visitors?|sales gallery)\b/, 4]],
    run: c => import("./domains/visits").then(m => m.runFootfall(c)),
  },
  {
    id: "cpvisits", label: "CP gallery visits", tab: "Channel Partners", paths: ["/channel-partners"],
    keywords: [[/\b(cp|channel partner|broker|partner)s? (gallery )?visits?\b|\bcp gallery\b/, 7]],
    run: c => import("./domains/visits").then(m => m.runCpVisits(c)),
  },
  {
    id: "digital", label: "Digital leads", tab: "Digital Leads", paths: ["/digital-leads"],
    keywords: [[/\b(digital|enquir\w+|inquir\w+|leads?|facebook|google|instagram|99 ?acres|agency|agencies|campaigns?|presales)\b/, 4]],
    run: c => import("./domains/visits").then(m => m.runDigital(c)),
  },
  {
    id: "cost", label: "Budget / cost", tab: "Cost", paths: ["/cost"],
    keywords: [[/\b(budgets?|budgeted)\b/, 5], [/\b(utili[sz]\w*|committed|commitments?|wbs|overrun\w*|over budget|cost|costs|spend|spent|expenses?|expenditure|po value|po lines?|purchase orders?)\b/, 3], [/\bpo ?(no|number|#)? ?9\d{9}\b|\b9\d{9}\b/, 5]],
    run: c => import("./domains/cost").then(m => m.runCost(c)),
  },
  {
    id: "vendors", label: "Vendor payables", tab: "Cost → Vendor Ageing", paths: ["/cost"],
    keywords: [[/\b(payables?|ageing|aging|vendor dues?|owe|owed|supplier dues?|vendor outstanding|vendors? (balance|payments?))\b/, 5], [/\b(vendors?|suppliers?)\b/, 2]],
    run: c => import("./domains/vendors").then(m => m.runVendors(c)),
  },
  {
    id: "pr2po", label: "PR to PO", tab: "PR to PO", paths: ["/pr-to-po"],
    keywords: [[/\b(prs?|purchase requisitions?|purchase requests?|nfa|qms|pr to po|pr po)\b/, 5], [/\bpos?\b.*\b(pending|stuck|stage|approval|level|released|status|created|approved)\b|\b(pending|stuck|stage|approval|level|released|status|created|approved)\b.*\bpos?\b/, 4]],
    run: c => import("./domains/pr2po").then(m => m.runPr2Po(c)),
  },
  {
    id: "cases", label: "Case management", tab: "Case Management", paths: ["/case-management"],
    keywords: [[/\b(cases?|tickets?|complaints?|queries|query|grievances?|escalations?|tat|resolved|crm cases?)\b/, 4]],
    run: c => import("./domains/cases").then(m => m.runCases(c)),
  },
  {
    id: "loans", label: "Home loans", tab: "Loan Details", paths: ["/loan-details"],
    keywords: [[/\b(loans?|banks?|sanction\w*|disburs\w*|home loans?|lenders?|hdfc|icici|sbi|axis|pnb|bajaj|iifl)\b/, 5]],
    run: c => import("./domains/loans").then(m => m.runLoans(c)),
  },
  {
    id: "tracker", label: "Project tracker", tab: "Project Tracker", paths: ["/project-tracker", "/projects"],
    keywords: [[/\btowers?\b.*\bstatus\b|\bstatus of (the )?towers?\b/, 4], [/\b(progress|construction|tracker|milestones?|schedule|delayed|delays?|completion|completed percent\w*|percent complete|work packages?|how much (is )?(built|done|complete))\b/, 4]],
    run: c => import("./domains/tracker").then(m => m.runTracker(c)),
  },
];

export const byId = (id: string) => DOMAINS.find(d => d.id === id)!;
