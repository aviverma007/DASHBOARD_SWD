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
- **Status:** Built on mock data — awaiting SAP/Excel field mapping
- **Open Questions:**
  - Real status enum values (SOLD/UNSOLD assumed; BLOCKED is a guess)
  - Area type (carpet/saleable/super/chargeable unconfirmed)
  - Financial year vs calendar year convention for this project
  - Whether "Floor" is a meaningful drill level or Tower → Unit is more accurate
  - Whether customer/transaction detail exists in the source report at all
  - Whether "Group" is a distinct entity above Project or Project is the top level

---

## REQ-003

- **Module:** Inventory (rebuild on real data)
- **Requirement:** Replace mock-data Inventory Overview with a page built on
  real unit-level data, matching the look/feel and full feature set of the
  existing sales-intelligence HTML tool (reference: `smartworld_suite_v23`).
- **Source Data:** Decoded from the reference tool's embedded dataset —
  10,623 real units across 13 live Smartworld projects. See
  `src/data/smartworldInventory.json` / `src/data/inventoryLoader.ts`.
- **Calculation:** Mirrors the reference tool's formulas exactly (see
  `src/utils/inventoryStats.ts`) — verified to reconcile against the
  reference tool's own screenshots (Config Gap Analysis numbers checked
  and matched, e.g. Suites 1BHK=126, Edition 3.5BHK=147).
- **Filters:** Project (multi-select), Status (all/available/booked/
  management), Category (all/residential/commercial)
- **Visualization:** KPI strip (6 cards), Stock status donut, By category
  donut, Availability-by-project bars, Unsold-value-by-project bars,
  Config gap analysis matrix, By-configuration / Floor-rise / By-size-band
  group bars, Stack plan grid, searchable/paginated unit records table
- **Drill-down:** KPI/donut/bar/matrix-cell clicks narrow the project/status/
  category filters; stack-plan squares and table rows open a unit detail
  drawer (project/tower/floor/config/area/cost/rate/payment plan)
- **Validation:** N/A — this is a static bundled snapshot of real data, not
  a live feed; no upload/validation workflow attached yet
- **Status:** Built and verified — routed at `/` and `/inventory`
- **Open Questions:**
  - Whether this dataset should eventually sync live from SAP/Excel rather
    than being a static bundled JSON snapshot
  - Whether "Value available"/"Value booked" should also appear as KPIs
    on other modules (Sales, Revenue) once those are built
  - The reference tool's other modules (RM view, Activity, Performance,
    Bookings, Footfall) were not built here — only Inventory was in scope
    for this request

- **Module:** Sales, Collections, Revenue, Customers, Projects, Reports, Data Upload, Settings
- **Requirement:** Not yet specified
- **Status:** Placeholder — renders "coming soon" state, no logic built
- **Open Questions:** Awaiting requirements for each module
