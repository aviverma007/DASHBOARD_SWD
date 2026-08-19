# DASHBOARD_SWD

Real-estate project analytics BI dashboard for Smart World Developers —
Overview and Inventory pages, both now backed by a real INVR export
(6 projects, 3,386 units — see REQ-007/REQ-008 in the requirement
register), with drill-down navigation from Group → Project → Tower →
Floor → Unit.

This is **Phase 2/3** of an incremental build. See `docs/` for the living
requirement register, data dictionary, and calculation dictionary — these
are updated as real SAP/Excel data and field mappings are confirmed.

## Status

- ✅ Login (demo auth — see `src/store/authStore.ts`)
- ✅ Responsive app shell (sidebar, header, mobile drawer nav)
- ✅ **Overview (`/`)** — Available/Booked/Total KPI strip, project
  comparison chart, project breakup table, drill-down (Group → Project →
  Tower → Floor → Unit). Real data via `src/data/realOverviewData.ts`.
  See REQ-008.
- ✅ **Inventory (`/inventory`) — direct port of the reference
  sales-intelligence tool**, real data via `src/data/smartworldInventory.json`.
  See "Inventory module" below for what this covers.
- ⏳ Placeholder modules: Sales, Collections, Revenue, Customers, Projects,
  Reports, Data Upload, Settings — awaiting requirements
- ⏳ Real Excel/PDF export
- ⏳ Data upload + validation workflow
- ⏳ Backend/live SAP sync (current data is a static bundled snapshot,
  refreshed by re-running `scripts/convert_invr_export.py` against a new
  export)

## Inventory module (direct port)

The Inventory page is a line-by-line port of the reference Smartworld
sales-intelligence tool's Inventory module — same markup structure, same
CSS (scoped under `.sw-inv`, see `src/components/inventory/smartworldInventory.css`),
same state machine, same click behavior. It is intentionally *not*
restyled to match the rest of this app; it's meant to be pixel-faithful
to the source.

**Two independent state machines, matching the source exactly:**
- `state` (top filter bar: Project multi-select, Status, Category,
  Configuration) — drives the main page
- `scope` (drill path: an array of `{k, v, label}` conditions) — drives
  the right-side drawer, stacking as you drill Group → Project → Tower →
  Floor → Unit. Independent of the top filter bar, same as the source.

**Main page:** KPI strip (Total/Available/Booked·absorption/Management/
Area available/Area booked), Stock status + By category donuts (unit-count
and area variants), Availability-by-project + Unsold-area-by-project bars,
Config gap analysis matrix, By configuration / Floor rise / By size band
group-bar cards, searchable paginated unit records table,
Management-units-by-project table (shown when Status = Management).

**Drawer:** breadcrumb trail, insight line, drawer KPIs, stock-status
donut, then contextual drill content depending on depth (project → tower
ranking + stack plan + config/floor/size bars; tower → floor list +
config bars; group/status scope → by-project + by-config bars), plus its
own unit records list. Clicking a stack-plan square or table row opens a
unit detail view (project/tower/floor/config/area) with a "back to list"
button. No cost, rate, or payment-plan fields — this source doesn't
have them (see REQ-004 and REQ-007).

Source: `src/data/smartworldInventory.json`, generated from an INVR
export via `scripts/convert_invr_export.py` (see REQ-007 in the
requirement register). Re-run that script whenever a fresh INVR export
replaces the current one — configuration buckets are always derived
fresh from the new export's free-text config column, never carried over.

**Known discrepancy from the source (by design, not oversight):** in the
reference tool, clicking a unit row in the *main page's* records table
calls `unitDetail()` without opening the drawer shell, so nothing is
visible unless the drawer already happened to be open — even though the
card's own hint text says "click a row → detail." This port opens the
drawer in that case instead of replicating the silent no-op, since the
hint text makes clear that was not the intended behavior.

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (brand tokens in `src/index.css` under `@theme`)
- Zustand (filter state, drill-down state, demo auth state)
- Recharts (charts)
- TanStack Table (planned for detailed data tables)
- SheetJS / jsPDF / html2canvas (planned for Excel/PDF export)
- React Router

## Project structure

```
src/
  app/                  # app-level composition (reserved)
  components/
    layout/             # AppShell, Header, Sidebar
    filters/             # ProjectFilter, PeriodFilter, FilterBar (Overview's generic filter bar)
    kpi/                 # KpiCard, KpiStrip (Overview)
    charts/              # ProjectComparisonChart (Overview)
    tables/              # ProjectBreakupTable (Overview)
    drilldown/           # DrilldownDrawer, DrilldownContent (Overview)
    inventory/           # Sw* components — the ported Inventory tool (see below)
    common/              # EmptyState, SkeletonBlock, ComingSoon
  features/
    authentication/      # LoginPage, RequireAuth
    inventory/           # InventoryOverviewPage (Overview, routed at /)
                          # SmartworldInventoryPage (Inventory, routed at /inventory)
    sales/ projects/ reports/  # reserved for future modules
  services/              # inventoryService.ts — real data via realOverviewData.ts,
                          # same shape as a future real API would return
  store/                 # filterStore, drilldownStore, authStore (Zustand)
  types/                 # domain.ts, filters.ts (Overview's generic types)
                          # smartworldRaw.ts (Inventory's real dataset schema)
  utils/                 # calculations.ts (Overview's KPI math)
                          # smartworldLogic.ts (Inventory's ported KPI math)
                          # format.ts
  config/                # navigation.ts, filterDimensions.ts
  data/
    smartworldInventory.json  # the real INVR dataset (REQ-007), shared source
    realOverviewData.ts        # adapts it into Overview's Project/Tower/Floor/Unit shapes
scripts/
  convert_invr_export.py  # re-run against a fresh INVR export to refresh the data
docs/
  REQUIREMENT_REGISTER.md
  DATA_DICTIONARY.md
  CALCULATION_DICTIONARY.md
```

Both pages read from the same underlying `smartworldInventory.json` — Overview through
`realOverviewData.ts` + `services/inventoryService.ts`, Inventory directly through
`smartworldLogic.ts`. Refreshing the data (re-running `scripts/convert_invr_export.py`
against a new export) updates both pages at once.

## Development

```bash
npm install
npm run dev       # start dev server
npm run build     # type-check + production build
```

## Confirmed facts and remaining open questions

See `docs/REQUIREMENT_REGISTER.md` for the full history. Current state:

**Confirmed (no longer assumptions):**
- Unit status values are `Available` / `Booked` / `Management` — verified
  against the real INVR export (REQ-007), not a guess
- The current dataset covers 6 projects, 3,386 units — the person
  confirmed this is intentional, not a gap to fill from the old dataset
- No customer/booking-date or Payment Plan/Rate Band data exists in this
  source — confirmed absent, not merely unconfirmed

**Still open:**
1. Area type (carpet/saleable/super/chargeable) — the INVR export's
   "Total Super Area" column is used as-is; whether finer area-type
   breakdowns exist elsewhere hasn't been checked
2. Financial year vs calendar year convention (Overview's Period filter
   isn't yet wired to real historical snapshots — the current data is a
   single point-in-time snapshot)
3. Whether the 7 projects missing from the current export should be
   merged back in from another source, or are out of scope going forward
4. Whether "Group" (the level above Project in the drill-down) should
   ever represent a real multi-group structure, since the current data
   has no such field
