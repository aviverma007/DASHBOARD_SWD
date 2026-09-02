import { useMemo, useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { DATA_AS_ON } from "../../config/dataInfo";
import "../../components/inventory/smartworldInventory.css";

interface GuideEntry {
  term: string;
  body: string;
  /** Optional formula, rendered in monospace. */
  formula?: string;
}
interface GuideSection {
  title: string;
  intro?: string;
  entries: GuideEntry[];
}

/** Single source of truth for the in-app README. Searchable; every
 * entry documents a formula, a piece of logic, or a text shortcut. */
const GUIDE: GuideSection[] = [
  {
    title: "Text shortcuts & abbreviations",
    intro: "Short forms used across cards, charts and tables.",
    entries: [
      { term: "TSV", body: "Total Sale Value — the sum of the Basic Selling Price of all sold units in the current scope. Shown in ₹ Crore." },
      { term: "BSP", body: "Basic Selling Price of a unit — the base consideration value used for TSV and rate calculations." },
      { term: "Cr (Crore)", body: "₹1 Crore = ₹1,00,00,000 (ten million rupees). All value figures are shown in Crores." },
      { term: "L sq ft (Lakh sq ft)", body: "1 Lakh square feet = 1,00,000 sq ft. All area totals are shown in Lakh sq ft; individual units in plain sq ft." },
      { term: "₹/sqft", body: "Rate per square foot of super area. All rates in the app are on super area, not carpet area." },
      { term: "INVR", body: "The inventory export — source of the full unit stock with each unit's status (Available / Booked / Blocked), area, tower, floor and configuration." },
      { term: "PDRN", body: "The sales/booking export — source of every sold unit's record: customer, booking month, area, BSP, payment plan." },
      { term: "AOP", body: "Annual Operating Plan — the fiscal-year sales target (units, area, value) that Target vs Actual measures against." },
      { term: "FY / Quarters", body: "Fiscal year runs April to March. Q1 = Apr–Jun, Q2 = Jul–Sep, Q3 = Oct–Dec, Q4 = Jan–Mar. \u201CFY 2026-27\u201D means Apr'26–Mar'27." },
      { term: "CP", body: "Channel Partner — an external broker who sources a booking. \u201CDirect\u201D means the sale had no CP." },
      { term: "H / L", body: "Highest / Lowest single-unit rate within the current scope (project, tower or floor)." },
      { term: "Avg (blended)", body: "Wherever an average rate is shown, it is value-weighted (total value ÷ total area), not a simple average of unit rates." },
      { term: "Blocked units", body: "Units held back by the developer and not open for sale (previously labelled \u201Cmanagement units\u201D). Shown in red everywhere." },
      { term: "Absorption", body: "The share of total stock that has been booked/sold.", formula: "Absorption % = Booked units ÷ Total units × 100" },
      { term: "Project codes ED · LC · RES · SA · ST · TR", body: "Short codes for The Edition, Le Courtyard, Residencies, Sky Arc, Suites and Trump Residences — used where space is tight." },
      { term: "Data as on", body: `The date of the underlying INVR/PDRN extract (currently ${DATA_AS_ON}). Every number in the app reflects that snapshot, not live data.` },
    ],
  },
  {
    title: "Status colours",
    entries: [
      { term: "Green — Sold / Booked / Achieved", body: "Units that have been sold. On Target charts, green is the achieved series." },
      { term: "Light yellow — Available", body: "Open, sellable stock. Where yellow is used for text, a darker amber shade keeps it readable." },
      { term: "Red — Blocked", body: "Developer-held units not open for sale. Excluded from saleable area." },
      { term: "Orange — Available (Overview)", body: "On the Overview page, orange marks the not-yet-sold side (open stock + blocked together)." },
    ],
  },
  {
    title: "Overview page — formulas & logic",
    intro: "Sold comes from the sales export (PDRN); unsold from the inventory export (INVR).",
    entries: [
      { term: "Sold / Available / Total", body: "Total = every unit in the INVR stock register — identical to the Inventory tab. Sold = booking records in PDRN. Available = INVR units with no matching sale record (so Sold + Available = Total; includes blocked stock). A unit flagged booked in INVR without a PDRN record counts as available until the exports reconcile.", formula: "Sold % = Sold ÷ Total × 100" },
      { term: "TSV (per card)", body: "Sum of the BSP of every sold unit in that project (or all projects on the Business Overview card)." },
      { term: "Avg rate", body: "Blended selling rate over sold units.", formula: "Avg rate = Σ TSV ÷ Σ super area  (₹/sqft)" },
      { term: "H / L rate", body: "The single sold unit with the highest / lowest own rate.", formula: "Unit rate = unit TSV ÷ unit super area" },
      { term: "Absorption bar", body: "Green vs orange split of the total — sold share vs unsold share." },
      { term: "Rate extremes card (drill drawer)", body: "Recomputed for the current drill scope: at project level it scans all sold units; drill into a tower or floor and it narrows to that scope. Click either row to open the unit's full detail." },
      { term: "Location filter", body: "Gurgaon = The Edition, Sky Arc, Trump Residences. Noida = Le Courtyard, Residencies, Suites. Selecting a location recomputes the Business Overview totals for that city only." },
    ],
  },
  {
    title: "Inventory page — formulas & logic",
    entries: [
      { term: "Total / Available / Booked / Blocked", body: "Unit counts by INVR status. Cards are clickable — each applies the matching status filter." },
      { term: "Booked · absorption", body: "Booked units with the absorbed share of stock.", formula: "Absorption % = Booked ÷ Total × 100" },
      { term: "Area available", body: "Sum of super area of AVAILABLE units only — i.e. area except blocked units (and excluding already-booked area).", formula: "Area available = Σ super area where status = Available" },
      { term: "Area booked", body: "Sum of super area of sold units.", formula: "Area booked = Σ super area where status = Booked" },
      { term: "Drill path", body: "Project → Tower → Floor → Unit. Each level's donut, KPIs and tables recompute for that scope. Breadcrumbs jump back up." },
    ],
  },
  {
    title: "Target vs Actual — formulas & logic",
    intro: "Targets come from the AOP plan; actuals from the sales export, aligned on the same monthly timeline.",
    entries: [
      { term: "AOP summary card", body: "Fixed to the current fiscal year regardless of the Period filter; rolls to the next FY automatically each April.", formula: "%age = Achieved ÷ Total × 100" },
      { term: "Current month card", body: "The running calendar month's target vs achieved for the selected projects." },
      { term: "Adjusted (balance/mo)", body: "The pace now required on each remaining period to still hit the plan.", formula: "Adjusted = (Plan total − Achieved so far) ÷ remaining periods" },
      { term: "Quarter rollover", body: "When a month misses its target, the shortfall is redistributed across the remaining months of that same quarter — so each later month's adjusted target grows until the quarter catches up." },
      { term: "Catch-up badge (▲)", body: "The red ▲ number above a bar is the extra amount that period must now deliver on top of its original target." },
      { term: "Avg Rate chart", body: "Achieved rate per bucket is value-weighted from actual sales; target rate is the plan's monthly rate. \u201CNew required rate\u201D is the rate needed on the remaining area to still reach the plan's TSV.", formula: "Achieved rate = (Σ TSV × 10⁷) ÷ (Σ area × 10⁵)" },
      { term: "Merged target rate (multi-project)", body: "When several projects are selected, their target rate is value-weighted, never a simple average.", formula: "Merged rate = Σ sale value ÷ Σ area" },
      { term: "Project-wise rollup", body: "With more than one project selected, the two tower charts collapse to one row per project; a project's year rate is its towers' rates weighted by sold units. Selecting a single project restores the tower-wise view." },
      { term: "Units of measure", body: "Units chart in counts; TSV chart in ₹ Cr; Area chart in Lakh sq ft (plan area is stored in raw sq ft and normalised ÷ 1,00,000)." },
      { term: "Custom period", body: "Period → Custom gives From/To month dropdowns bound to the plan timeline. Picking them in either order works." },
    ],
  },
  {
    title: "Channel Partners — logic",
    entries: [
      { term: "Active vs cancelled", body: "Cancelled bookings are excluded from CP totals; rebookings are tracked so a re-sold unit isn't double-counted." },
      { term: "Direct sales", body: "Bookings with no channel partner. Shown separately and excluded from CP rankings." },
      { term: "Top-N rankings", body: "Partners ranked by units, area or TSV of their active bookings within the current filter." },
    ],
  },
  {
    title: "Gallery Footfall — logic",
    entries: [
      { term: "Two tabs, two datasets", body: "Footfall = customer walk-ins from the presales footfall export (27,289 site visits, with CRM opportunity numbers). CP Visits = channel-partner reps visiting galleries from the dedicated CP-visit export (48,397 visits, 5,421 partners) — partner engagement, not customer traffic, so it carries no booking outcomes by design." },
      { term: "Projects visited", body: "Counts distinct non-blank projects/campaigns; rows with the project left blank in the export are excluded from the count but never from totals." },
      { term: "New partner vs revisit", body: "A partner is \u201Cnew\u201D if their first-ever visit in the data falls inside the selected period; any visit after a partner's first is a revisit." },
      { term: "Future-dated visits", body: "The export contains scheduled (future) site visits; they appear in trends on their scheduled month, but momentum comparison never offers a period that hasn't begun." },
    ],
  },
  {
    title: "Digital Leads — logic",
    entries: [
      { term: "Enquiry funnel", body: "Enquiries → Qualified → Site visit+ → Booked, straight counts of opportunity stages from the digital presales export. Every enquiry row is EN-numbered; personal contact fields never enter the app." },
      { term: "Stacked bars", body: "Sub-source, project, agency and owner charts show each value's total bar with a darker green overlay = how many of those reached Qualified; the tooltip gives the qualified share." },
    ],
  },
  {
    title: "Bookings — logic",
    entries: [
      { term: "Single source", body: "Overview, Bookings, Target drills, Reports and Channel Partners all derive from one PDRN export (actives + cancellations, with broker). Refreshing that one file updates them all; the INVR export separately drives Total/Available." },
      { term: "Agreement value", body: "Σ basic selling price (TSV) of active bookings in scope; avg ticket = value ÷ bookings; area sold shows the blended ₹/sqft." },
      { term: "Cancelled", body: "Bookings with status Cancelled in the PDRN export (rebooked units tracked separately so a re-sold unit isn't double-counted); scope-aware." },
      { term: "Direct vs channel-partner", body: "In PDRN every booking is broker-attributed, so the true source split comes from the footfall export's Booked-stage walk-ins — that card is labelled with its own universe (1,209) to keep the two datasets distinct." },
      { term: "Financial-year periods", body: "All quarters follow the Indian FY: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar, labelled by FY end year (Jul–Sep 2026 = Q2 FY27). Years in momentum are FYs too. Periods that haven't begun are never offered." },
    ],
  },
  {
    title: "Interactions & shortcuts",
    entries: [
      { term: "Click to drill", body: "Almost everything is clickable: chart bars, donut slices, funnel rows, trend months and weekday bars open a side drill drawer scoped to that value; inside a drawer, further clicks stack as removable chips (removing the last chip closes it). Records rows open a second-level detail panel on top." },
      { term: "Maximize any chart", body: "The \u2924-style button at each card's top-right opens the chart enlarged in an overlay; click outside, press Esc, or hit \u2715 to return." },
      { term: "Sortable full lists", body: "Bar lists show every value with an inner scroll; the \u2193/\u2191 button flips between high\u2192low and low\u2192high." },
      { term: "Bar / Line toggle", body: "Flips the three Target vs Achieved charts (Units, TSV, Area) between bar and line views together." },
      { term: "Month / Quarter / Year toggle", body: "Re-buckets all four Target charts to the chosen granularity; the shortfall logic follows the same buckets." },
      { term: "Shared chart slider", body: "The scroll slider above the Target charts moves all of them together so months stay aligned." },
      { term: "Multi-select filters", body: "Project dropdowns support any combination; \u201CAll projects\u201D is the master option. Choosing a Location narrows the list and clears project picks." },
      { term: "Reset", body: "Every filter bar's Reset returns that page to its default state (all projects, all time)." },
      { term: "Sidebar", body: "The Collapse arrow shrinks the nav to an icon rail; section headings (SALES / INVENTORY / WORKSPACE) fold their groups." },
      { term: "Wide charts scroll", body: "Charts with many towers or months keep a fixed readable scale and scroll horizontally instead of squeezing." },
      { term: "Reports", body: "The Reports page exports the underlying datasets to Excel. PDF export is planned." },
      { term: "Notes", body: "The Notes page (Workspace) is a personal scratchpad saved in this browser — use the search box to filter your notes." },
    ],
  },
];

const INPUT: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "10px 12px 10px 36px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "var(--ink)",
  background: "#fff",
};

function highlightMatch(entry: GuideEntry, q: string): boolean {
  if (!q) return true;
  const hay = (entry.term + " " + entry.body + " " + (entry.formula ?? "")).toLowerCase();
  return hay.includes(q);
}

export function GuidePage() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sections = useMemo(
    () =>
      GUIDE.map(s => ({ ...s, entries: s.entries.filter(e => highlightMatch(e, q)) })).filter(
        s => s.entries.length > 0 || (!q ? true : false)
      ),
    [q]
  );

  const totalHits = sections.reduce((n, s) => n + s.entries.length, 0);

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 20px 48px" }}>
        {/* Header + search */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <BookOpen size={22} style={{ color: "var(--gold)" }} />
          <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>User Guide</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 14 }}>
          Every formula, calculation, colour and shortcut used across the dashboard, in one searchable place.
        </div>
        <div style={{ position: "relative", marginBottom: 6 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--mut)" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the guide — try “TSV”, “absorption”, “adjusted”, “blocked”…"
            style={INPUT}
          />
        </div>
        {q && (
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 10 }}>
            {totalHits} match{totalHits === 1 ? "" : "es"} for “{query.trim()}”
          </div>
        )}

        {/* Sections */}
        {sections.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "30px 20px", color: "var(--mut)", fontSize: 13.5, marginTop: 12 }}>
            Nothing in the guide matches “{query.trim()}”.
          </div>
        )}
        {sections.map(section => (
          <div key={section.title} className="card" style={{ marginTop: 14 }}>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 16.5, fontWeight: 700, color: "var(--ink)", borderBottom: "2px solid var(--line)", paddingBottom: 8, marginBottom: 4 }}>
              {section.title}
            </div>
            {section.intro && <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>{section.intro}</div>}
            {section.entries.map(e => (
              <div key={e.term} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{e.term}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 3 }}>{e.body}</div>
                {e.formula && (
                  <code
                    style={{
                      display: "inline-block",
                      marginTop: 6,
                      background: "#f4f1ea",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      padding: "5px 10px",
                      fontSize: 12.5,
                      color: "#1E3163",
                    }}
                  >
                    {e.formula}
                  </code>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
