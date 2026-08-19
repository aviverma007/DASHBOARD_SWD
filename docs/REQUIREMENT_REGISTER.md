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

---

## REQ-008

- **Module:** Overview (generic Phase 2/3 scaffold — `/`)
- **Requirement:** Update the Overview page to use the same real data
  now powering Inventory, instead of the synthetic mock generator it
  had been running on since Phase 2/3.
- **What this actually required (more than a data swap):** Overview's
  KPI strip / comparison chart / breakup table / drill-down were built
  around `Sold`/`Unsold`/`Blocked` terminology — an explicit,
  documented *guess* from before any real data existed (see the
  original ASSUMPTION comments in `domain.ts`, now removed). Now that
  real, confirmed status values exist (`Available`/`Booked`/
  `Management`, verified against the actual INVR export in REQ-007),
  force-fitting real data through "Sold/Unsold" labels would have been
  factually wrong — Available isn't the same concept as Unsold. Renamed
  throughout rather than relabeling only the display strings:
  - `UnitStatus`: `SOLD|UNSOLD|BLOCKED` → `AVAILABLE|BOOKED|MANAGEMENT`
    (`types/domain.ts`)
  - `ProjectContribution`/`PeriodSnapshot` fields: `soldUnits`/
    `unsoldUnits`/`soldArea`/`unsoldArea`/`soldPercent` →
    `availableUnits`/`bookedUnits`/`availableArea`/`bookedArea`/
    `bookedPercent`
  - `InventoryTotals`: `sold`/`unsold`/`blockedUnits` → `available`/
    `booked`/`managementUnits` (`utils/calculations.ts`)
  - `kpiContext` type and every consumer: `"sold"|"unsold"|"total"` →
    `"available"|"booked"|"total"` (`drilldownStore.ts`,
    `DrilldownContent.tsx`, `KpiStrip.tsx`)
  - Display copy in `KpiStrip.tsx`/`ProjectComparisonChart.tsx`/
    `ProjectBreakupTable.tsx`: "Sold vs Unsold" → "Available vs Booked",
    "Sold %" → "Booked %" (i.e. absorption)
- **New real-data adapter:** `src/data/realOverviewData.ts` converts
  the same `smartworldInventory.json` (REQ-007) into the `Project`/
  `Tower`/`Floor`/`Unit` shapes this scaffold's calculation layer
  expects — same output shape as the old `mockData.ts` generator, real
  source instead of synthetic. `src/services/inventoryService.ts`
  re-pointed from `MOCK_DATA` to `REAL_DATA`; no component code needed
  to change beyond the terminology rename above, confirming the
  service-layer abstraction from the original blueprint did its job.
- **Removed:** `src/data/mockData.ts` (the synthetic generator) — once
  nothing imported it, it was a dead file with type errors against the
  renamed `UnitStatus`, not something to keep "just in case." Recoverable
  from git history if ever needed.
- **Real behavioral fix, not just a rename:** the floor-level unit list
  used to disable/grey out any unit without a `customerId`, gating the
  deepest drill level behind customer data. The real INVR export has no
  customer/booking-date field at all (confirmed in REQ-007), which would
  have made every unit permanently unclickable — the deepest drill level
  would have been unreachable for real data. Removed that gate; unit
  detail now always opens and states plainly that no customer/booking
  data exists in this source, rather than silently disabling the click.
- **Validation:** Ran the same aggregation logic in Node directly
  against the real dataset — group totals (1,153 available / 2,066
  booked / 167 management) and every per-project breakdown match REQ-007's
  already-verified numbers exactly.
- **Status:** Built, type-checked, verified.
- **Open Questions:**
  - Whether "Booked %" (absorption) is the right framing for this
    scaffold's "contribution/sold%" column, or whether the person wants
    a different metric there now that real numbers are behind it
  - This scaffold's drill-down still references a generic "Group" level
    above Project that doesn't exist as a concept in the real INVR
    data (there's no group-level source field) — currently just
    labeled "All Projects," which works, but worth flagging if a real
    multi-group structure ever needs representing

---

## REQ-009

- **Module:** Inventory (direct port) — donut card consolidation
- **Requirement:** Consolidate the 4 donut cards (Stock status, By
  category, Stock status by area, By category by area) into 2 cards —
  "Stock status" and "By category" — each showing Units and Area as two
  side-by-side donuts within the same card, with no loss of information,
  colors, percentages, or drill-down behavior.
- **Changes:**
  - New CSS: `.dual-donut` (2-column grid, divider between columns,
    collapses to stacked on mobile ≤640px), `.dual-donut-label` (small
    uppercase "Units"/"Area" header per column, with a gold "sq ft" pill
    on the Area side)
  - JSX: each card now renders two `.dual-donut-col` blocks instead of
    two separate cards — same `SwDonut`/`SwDLegend` components, same
    `statusSegs`/`statusAreaSegs`/`catSegs`/`catAreaSegs` data, same
    click handlers (`handleKSt`, `openScopeKey("cat", ...)`) — nothing
    about the underlying data or interactions changed, only layout
  - Removed the now-redundant `grid g2` wrapper that held the second
    row of area-only cards
- **Validation:** Confirmed the old separate card titles ("Stock status
  by area", "By category by area") no longer appear anywhere in the
  built bundle — no leftover duplicate cards. Re-verified all
  percentages against the dataset match the reference screenshot exactly
  (Available 34.1%/32.3%, Booked 61.0%/65.1%, Management 4.9%/2.6% for
  units/area respectively) — confirms only layout changed, not the
  underlying calculation.
- **Status:** Built, type-checked, verified.
- **Open Questions:** None.

---

## REQ-010

- **Module:** Overview (`/`) and its drill-down drawer — full visual/UX
  redesign to match Inventory
- **Requirement:** Redesign Overview and its side drawer so both feel
  like the same product as Inventory — same cards, colors, typography,
  filter bar, KPI styling, drill-down drawer shell — without losing any
  existing data, calculations, or interaction. Inventory stays the
  design reference and was not touched.
- **Approach:** Rather than reskinning Overview's old Tailwind-based
  components to *imitate* Inventory's look, Overview now directly reuses
  Inventory's own stylesheet (`smartworldInventory.css`, imported once
  by the new `.sw-inv`-wrapped page and drawer) and CSS classes (`.card`,
  `.kpi`/`.kpis`, `.barrow`/`.track`, `.dkpis`/`.dkpi`, `.insight`,
  `.crumbs`/`.crumb`, `#ov`/`#dw`/`.dwh`/`.dwb`, plain `table`). This is
  a single shared design system, not two parallel implementations of the
  same look — directly satisfying the "avoid maintaining separate
  styling" requirement rather than approximating it.
- **New components** (`src/components/overview/`):
  - `OverviewFilters.tsx` — navy gradient filter bar (Project
    multi-select + Period select + Reset dashboard), same markup
    pattern as Inventory's `SwFilters`. No new filters introduced —
    same two controls as before (Project, Period/FY), same
    `useFilterStore` binding.
  - `OverviewKpis.tsx` — replaces `KpiStrip`/`KpiCard`. Available/
    Booked/Total each combine units + area + percentage in one `.kpi`
    card (matching the brief's explicit ask), rather than Inventory's
    pattern of splitting units and area into separate KPI cards — this
    is Overview's own information design, using Inventory's card shell.
    Management-unit note uses `.blkbar`, matching Inventory's own
    management-units banner exactly.
  - `OverviewProjectBars.tsx` — replaces the Recharts-based
    `ProjectComparisonChart`. Inventory's entire design system never
    uses a charting library for breakdowns like this — every such
    breakdown is a sorted `.barrow`/`.track` bar-row list. Reusing that
    pattern here (rather than reskinning Recharts to imitate it) is a
    closer match to "feel like the same product," and drops a
    dependency Overview no longer needs (Recharts remains in
    package.json, unused — not worth an uninstall pass for this
    change, flagged here for whoever next touches dependencies).
  - `OverviewProjectTable.tsx` — replaces `ProjectBreakupTable`. Same
    data, same row-click-to-drill, restyled to Inventory's plain
    `table`/`th`/`td.n` markup inside a `.card`.
  - `OverviewDrawer.tsx` — replaces `DrilldownDrawer`. Same `#ov`/`#dw`/
    `.dwh`/`.crumbs`/`.dwb` shell as `SwDrawer`, self-contained in a
    `.sw-inv` wrapper so it renders correctly regardless of where in the
    DOM it's mounted. The old fullscreen toggle was dropped — Inventory's
    own drawer doesn't have one; its fixed `min(760px, 95vw)` width is
    already wide enough for the stack plan, so this drops UI Inventory
    itself doesn't have rather than inventing a divergent pattern.
  - `OverviewDrawerContent.tsx` — replaces `DrilldownContent`. Adds an
    insight line and a `.dkpis` grid (Units / Available / Absorption /
    Area available, per the brief) at every level; adds a **Tower
    absorption ranking** bar list and a **project-wide stack plan** at
    the project level — neither existed in the old drawer, which only
    had a flat project→tower→floor→unit breakup list with no stack
    plan at all. Floor and unit levels are preserved for list-based
    browsing alongside the stack plan's direct click-to-unit path,
    matching how Inventory itself offers both a ranked list and a stack
    plan side by side.
  - `OverviewStackPlan.tsx` — new. Adapted from Inventory's
    `SwStackPlan` to Overview's `Tower`/`Floor`/`Unit` domain types
    instead of raw INVR tuples. Required adding a numeric `order` field
    to the `Floor` type (`types/domain.ts`) and populating it in
    `realOverviewData.ts` from the raw dataset's floor-position value
    (previously discarded during the REQ-008 adapter build) — without
    it, floors couldn't be sorted consistently across towers for a
    project-wide grid. Verified zero order→label collisions across the
    full dataset before trusting this grouping key.
  - `getUnitsForTower`/`getProjectStackData` added to
    `inventoryService.ts` to supply the stack plan and tower ranking in
    as few round trips as the existing per-floor functions.
- **Removed** (fully unreferenced after the redesign, confirmed via
  grep before deletion): `KpiCard.tsx`, `KpiStrip.tsx`,
  `ProjectComparisonChart.tsx`, `ProjectBreakupTable.tsx`,
  `DrilldownDrawer.tsx`, `DrilldownContent.tsx`, `FilterBar.tsx`,
  `ProjectFilter.tsx`, `PeriodFilter.tsx`, and their now-empty parent
  folders (`components/kpi`, `components/charts`, `components/tables`,
  `components/drilldown`, `components/filters`).
- **`AppShell.tsx`:** both `/` and `/inventory` now suppress the app's
  generic `FilterBar` and content padding (renamed the guarding
  variable from `isSmartworldInventoryRoute` to `managesOwnChrome` to
  reflect that it's no longer Inventory-specific).
- **Validation:**
  - Verified project-level aggregate numbers the drawer will show (e.g.
    Smartworld The Edition: 305 available / 640 booked / 11 management
    / 956 total) match the per-project figures already verified in
    REQ-007/008.
  - Verified the stack plan's floor-grouping key (`order|name`) has zero
    collisions across the entire dataset — confirms floors group
    correctly across towers without merging or splitting real floor
    levels.
  - Type-check and production build both pass. Bundle size dropped
    further (1.09MB vs. 1.47MB) now that Recharts is no longer imported
    by anything.
- **Status:** Built, type-checked, verified.
- **Open Questions:**
  - Whether Recharts should be uninstalled from `package.json` now that
    nothing imports it, or kept in case a future module wants it
  - Whether the drawer's dropped fullscreen toggle is missed on very
    narrow desktop widths — Inventory's own drawer doesn't have one, so
    this matches the reference exactly, but it's a behavior change from
    the pre-redesign Overview drawer worth flagging
