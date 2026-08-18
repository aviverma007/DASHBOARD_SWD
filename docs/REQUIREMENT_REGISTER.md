# Requirement Register

Living document. Append new requirements as they're confirmed; never remove or
silently alter an earlier one — see project instructions Section 37.

---

## REQ-001

- **Module:** Inventory Overview
- **Requirement:** Sold / Unsold / Total — Units, Area, Percentage
- **Source Data Required:** Unit ID, Project, Tower, Floor, Sales Status, Area
- **Calculation:** See `docs/CALCULATION_DICTIONARY.md`
- **Filters:** Group, Project (multi-select / All), Period (Monthly/Quarterly/Yearly)
- **Visualization:** KPI cards (Sold/Unsold/Total), stacked bar chart (project comparison),
  project-wise breakup table
- **Drill-down:** Group → Project → Tower → Floor → Unit → Customer (if source data permits)
- **Validation:** See `docs/DATA_DICTIONARY.md`
- **Status:** Built on mock data — awaiting SAP/Excel field mapping.
  **Superseded at the route level by REQ-003** (the `/` and `/inventory`
  routes now render the direct-port page instead), but this spec and its
  mock-data scaffold are kept as the pattern for future modules.
- **Open Questions:**
  - Real status enum values (SOLD/UNSOLD assumed; BLOCKED is a guess)
  - Area type (carpet/saleable/super/chargeable unconfirmed)
  - Financial year vs calendar year convention for this project
  - Whether "Floor" is a meaningful drill level or Tower → Unit is more accurate
  - Whether customer/transaction detail exists in the source report at all
  - Whether "Group" is a distinct entity above Project or Project is the top level

---

## REQ-003

- **Module:** Inventory (direct port)
- **Requirement:** Copy the reference Smartworld sales-intelligence tool's
  Inventory module into this app's Inventory tab exactly — same filters,
  same KPIs, same cards, same drill-down/drawer behavior, same look and
  feel. Not a reinterpretation; a line-by-line port.
- **Source Data:** Real unit-level data (10,623 units, 13 live Smartworld
  projects), decoded from the reference tool's embedded dataset. See
  `src/data/smartworldInventory.json`.
- **Calculation:** `src/utils/smartworldLogic.ts` is a direct port of the
  reference tool's pure functions (`baseUnits`, `match`, `scopedUnits`,
  `stats`, `groupByKey`, `statusBarsData`, band functions, `CR`/`pct`/
  `fNum` formatters) — same names, same logic, verified to reconcile
  exactly against the reference tool's own numbers (Total 10,623 /
  Available 1,631 / Booked 8,806 / Management 186; Suites 1BHK=126,
  2BHK=143 matching the Config Gap Analysis screenshot).
- **Filters:** Project (multi-select), Status (all/available/booked/
  management), Category (all/residential/commercial), **Configuration**
  (all/1 BHK/.../Commercial) — four filters, matching the source exactly
  (the Configuration filter was missing from an earlier attempt at this
  page and has been added here).
- **Visualization:** KPI strip (6 cards), Stock status + By category
  donuts, Availability-by-project + Unsold-value-by-project bars, Config
  gap analysis matrix, By configuration / Floor rise / By size band / By
  price band / By unit type group-bar cards, searchable paginated unit
  records table, Management-units-by-project table.
- **Drill-down:** Two independent state machines, matching the source —
  the top filter bar (`state`) drives the main page; a separate drill
  path (`scope`, an array of `{k,v,label}` conditions) drives the
  right-side drawer and stacks as the person drills Group → Project →
  Tower → Floor → Unit, with breadcrumb chips to jump back.
- **Validation:** N/A — static bundled snapshot, not a live feed.
- **Status:** Built, type-checked, and verified against the reference
  tool's own numbers. Routed at `/` and `/inventory`.
- **Open Questions / Known Discrepancies:**
  - This is a static snapshot, not a live SAP/Excel sync — flagged as a
    follow-up if the person wants it to stay current
  - One deliberate deviation from the source: clicking a unit row in the
    main page's records table opens the drill drawer in this port; in the
    reference tool's own DOM-based implementation, that click silently
    does nothing unless the drawer already happened to be open elsewhere
    — which contradicts the card's own "click a row → detail" hint text,
    so this port treats it as an intended-but-unimplemented behavior in
    the source rather than something to replicate
  - The reference tool's other modules (RM view, Activity, Performance,
    Bookings, Footfall) were out of scope for this request — only
    Inventory was ported

---

## REQ-004

- **Module:** Inventory (direct port) — value → area conversion
- **Requirement:** Remove every ₹-value display from the Inventory tab.
  Replace with area (sq ft) equivalents where a sensible one exists;
  remove the metric/card entirely where it doesn't.
- **Changes:**
  - KPI strip: "Value available" / "Value booked" → "Area available" /
    "Area booked" (`stats()` now returns `areaAv`/`areaBk` instead of
    `vav`/`vbk`)
  - "Unsold value by project" → "Unsold area by project" (sums `u[6]`
    area instead of `u[7]` cost)
  - Drawer insight line and drawer mini-KPI: "₹X available" → area
    available
  - Unit records table: dropped the "Unit cost" column (super area is
    already shown; showing both units would be redundant, not clearer)
  - Unit detail spec sheet: dropped "Total unit cost" and "Rate" (₹/sq
    ft) rows — there's no area-equivalent for a per-sq-ft rate
  - **Removed entirely, not converted:** "By price band" card (both on
    the main page and inside the drawer) and its underlying `priceBand()`
    /`PB` grouping. Price bands are inherently value-denominated (`< ₹1.5
    Cr`, `₹1.5–2.5 Cr`, etc.) with no meaningful area analog — "By size
    band" already covers the area-grouping use case, so this wasn't
    duplicated. Also removed the unused `rateOut()` function and the
    dead `'rate'`/`'pb'` scope-condition keys that depended on cost.
- **Validation:** Verified against the real dataset — total area
  available 41.08 L sq ft, total area booked 159.13 L sq ft (raw figures:
  4,108,078 / 15,912,624 sq ft), consistent with the previously-verified
  1,631/8,806 available/booked unit split. Confirmed zero remaining `₹`
  characters anywhere in the built JS bundle.
- **Status:** Built, type-checked, and verified.
- **Open Questions:** None — this was a subtractive/renaming change with
  no ambiguous cases left unresolved, aside from the price-band removal
  noted above, which was flagged rather than silently replaced.

---

## REQ-005 (placeholder modules)

- **Module:** Sales, Collections, Revenue, Customers, Projects, Reports, Data Upload, Settings
- **Requirement:** Not yet specified
- **Status:** Placeholder — renders "coming soon" state, no logic built
- **Open Questions:** Awaiting requirements for each module

---

## REQ-006

- **Module:** Inventory (direct port) — area-based donut charts
- **Requirement:** Add two more donut charts alongside the existing
  Stock status / By category donuts, breaking down the same dimensions
  by area (sq ft) instead of unit count.
- **Changes:**
  - `Stats` gained `areaBl` (management-unit area) alongside the
    existing `areaAv`/`areaBk`, so the area-based Stock status donut can
    show all three segments like its unit-count counterpart
  - `SwDonut`/`SwDLegend` gained an optional `valueFormatter` prop
    (defaults to `fNum`, unit count) so the same components render either
    unit-count or area donuts without duplicating markup
  - Two new cards added directly below the existing pair: "Stock status
    by area" and "By category by area" — same click-to-drill behavior,
    same colors, same layout
- **Validation:** Verified against the real dataset — area splits sum
  correctly to the grand total both ways (202.89 L sq ft). Notably the
  area view tells a different story than the unit-count view: Available
  is 15.4% of units but 20.2% of area, meaning available units run
  larger on average than the overall stock.
- **Status:** Built, type-checked, verified.
- **Open Questions:** None.

---

## REQ-007

- **Module:** Inventory (direct port) — data source swap
- **Requirement:** Replace the old bundled dataset entirely with a fresh
  INVR export (`INVR-All_Project_18-8-2026.xlsx`, "Merged" sheet).
- **Source shape:** 3,386 rows, 11 columns (Source, Project Name, Unit
  Description, Project wise Unit Description, Status, Unit Type, Floor,
  BHK, Tower, Total Super Area, Total Unit Cost). No Payment Plan or
  Rate Band columns.
- **Confirmed decisions (user, this session):**
  1. Only the 6 projects present in this file are kept — Smartworld The
     Edition, Sky Arc, Le Courtyard, Suites, Residencies, Trump
     Residences Gurgaon. The other 7 projects that existed in the old
     dataset (One DXP, One DXP Select, One DXP Street, Orchard, Gems 1,
     Gems 2, Nature's Court) are gone. This is intentional — confirmed
     explicitly, not an oversight.
  2. Any status other than "Available"/"Booked" (this export has
     "Management Unit" and one row of "N/A for Sale") folds into
     Management.
  3. Configuration buckets are derived fresh from the free-text `BHK`
     column every time new data is loaded — never carried over from a
     previous run. See `scripts/convert_invr_export.py`.
- **Conversion:** `scripts/convert_invr_export.py` — reusable for future
  refreshes, not a one-off. Parses `BHK` → `CFG` bucket (regex extracts
  the leading digit before "BHK"; "Retail Shop"/"Shop" → "Commercial")
  and `Floor` label → numeric floor value (handles ordinal text, "Ground
  Floor", "Upper Ground Floor", "Second Floor" as a distinct mezzanine
  level at Le Courtyard, and "12-A Floor"-style half-floors). Both
  parsers raise loudly (`ValueError`) on any value they don't recognize
  rather than silently bucketing into "Unspecified" — verified against
  every one of the 50 distinct `BHK` values and 55 distinct `Floor`
  labels in this export with zero fallback rows before trusting the
  output.
- **Fields with no source in this export:** Payment Plan and Rate Band.
  `PP`/`RB` arrays are empty; `unit[10]`/`unit[11]` are always `-1`/`0`
  (positional placeholders in the `RawUnit` tuple, unused). The unit
  detail view's "Payment plan" row and the Configuration row's rate-band
  parenthetical were removed from `SwDrawer.tsx` — showing them would
  mean displaying nothing or a fake value, so they were removed rather
  than showing empty rows. Category classification now keys off
  `Unit Type == "Unit"` (this export's only Commercial marker; those 502
  rows are exactly the "Retail Shop" units at Le Courtyard) instead of
  the finer Shop/Retail/Restaurant/KIOSK distinction the old dataset had.
- **Data quirk found and preserved as-is (not "fixed"):** `Total Unit
  Cost` is populated only for Booked units in this export — Available
  and Management units all show 0, plus one Booked row that's also 0.
  Doesn't affect anything currently displayed since cost/value was
  already removed from the app (REQ-004), but worth knowing if cost
  displays are ever added back for this data source.
- **Validation:** Verified the converted JSON's aggregate stats (Total
  3,386 / Available 1,153 / Booked 2,066 / Management 167) and every
  per-project breakdown against a direct pandas analysis of the source
  file — exact match, including the one row of "N/A for Sale" correctly
  folding into Smartworld The Edition's management count (11 = 10
  Management Unit + 1 N/A for Sale). Confirmed no project exceeds the
  drill-down's 40-tower display threshold (max is Le Courtyard at 21).
- **Status:** Built, type-checked, verified. Bundle size dropped
  (1.47MB vs. 1.92MB previously) since the dataset itself is smaller.
- **Open Questions:**
  - Whether the 7 dropped projects should eventually get their own
    refreshed source and be merged back in, or whether they're
    considered out of scope for this dashboard going forward
  - Whether Payment Plan / Rate Band data exists in some other INVR
    export variant and should be joined in if so
