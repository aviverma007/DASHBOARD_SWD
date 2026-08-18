# DASHBOARD_SWD

Real-estate project analytics BI dashboard for Smart World Developers —
Inventory / Sales Overview with Sold/Unsold/Total KPIs and drill-down
navigation from Group → Project → Tower → Floor → Unit → Customer.

This is **Phase 2/3** of an incremental build. See `docs/` for the living
requirement register, data dictionary, and calculation dictionary — these
are updated as real SAP/Excel data and field mappings are confirmed.

## Status

- ✅ Login (demo auth — see `src/store/authStore.ts`)
- ✅ Responsive app shell (sidebar, header, filter bar, mobile drawer nav)
- ✅ **Inventory page — now built on REAL data** (10,623 actual units across
  all 13 live Smartworld projects), styled to match the reference
  sales-intelligence tool exactly (navy/gold/cream palette, Georgia serif
  numerals). See "Inventory module" below.
- ✅ Cross-filtering — clicking a chart bar or table row filters the dashboard
- ⏳ Placeholder modules: Sales, Collections, Revenue, Customers, Projects,
  Reports, Data Upload, Settings — awaiting requirements
- ⏳ Real Excel/PDF export (buttons present on the generic dashboard scaffold,
  not yet wired for Inventory)
- ⏳ Data upload + validation workflow
- ⏳ Backend/live SAP sync (current inventory data is a static bundled
  snapshot, not a live feed)

## Inventory module (real data)

Source: unit-level data decoded from the existing sales-intelligence HTML
tool's embedded dataset (`src/data/smartworldInventory.json`, ~10,600 units).
This is real inventory, not mock data — verified to reconcile exactly against
the reference tool's own numbers (see `src/data/inventoryLoader.ts` for the
decode logic).

Features, matching the reference tool 1:1:
- KPI strip: Total units, Available, Booked · absorption, Management units,
  Value available, Value booked
- Stock status donut, By category donut (Residential/Commercial)
- Availability by project (3-segment bars), Unsold value by project
- **Config gap analysis** matrix (project × configuration, sold-out/low/
  available/high bands)
- By configuration / Floor rise / By size band group-bar breakdowns
- **Stack plan** (floors × towers grid, one square per unit, click for detail)
- Searchable, paginated unit records table
- Unit detail drawer (spec sheet: project/tower/floor/config/area/cost/rate/
  payment plan)
- Management-units breakdown by project

All filters (Project multi-select, Status, Category) operate on the real
dataset and cascade through every card on the page.

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
    filters/             # generic FilterBar (used by non-Inventory routes)
    kpi/ charts/ tables/ drilldown/  # generic Phase-2 scaffold, reusable
                                       # once other modules get real data
    inventory/           # Inventory-specific: InvKpiCard, InvDonut,
                          # ConfigGapMatrix, StackPlan, UnitRecordTable,
                          # UnitDetailDrawer, InvFilterBar, etc.
    common/              # EmptyState, SkeletonBlock, ComingSoon
  features/
    authentication/      # LoginPage, RequireAuth
    inventory/           # InventoryPage — the real-data page (routed)
                          # InventoryOverviewPage — earlier mock-data
                          # version, kept as scaffold reference, not routed
  services/              # inventoryService.ts — mock-data service layer,
                          # not used by the current Inventory page
  store/                 # filterStore, drilldownStore, authStore (Zustand)
  types/                 # domain.ts, filters.ts (generic scaffold)
                          # inventoryRaw.ts (real dataset schema)
  utils/                 # calculations.ts (generic scaffold)
                          # inventoryStats.ts (real-data KPI math,
                          # mirrors the reference tool's formulas exactly)
                          # format.ts
  data/
    smartworldInventory.json  # REAL unit-level data, ~10,600 units
    inventoryLoader.ts         # decodes the JSON into typed units
    mockData.ts                 # earlier synthetic data, unused by Inventory now
  config/                # navigation.ts, filterDimensions.ts
docs/
  REQUIREMENT_REGISTER.md
  DATA_DICTIONARY.md
  CALCULATION_DICTIONARY.md
```

The generic filter/drilldown/KPI scaffold from Phase 2 is intentionally kept
(not deleted) — it's the pattern to reuse once Sales/Collections/Revenue get
real data of their own. The Inventory page itself no longer goes through
that generic path; it reads directly from the real dataset via
`inventoryLoader.ts` and `inventoryStats.ts`.

## Development

```bash
npm install
npm run dev       # start dev server
npm run build     # type-check + production build
```

## Key assumptions awaiting confirmation

See `docs/REQUIREMENT_REGISTER.md` for the full list. Highlights:

1. Unit status values (SOLD/UNSOLD assumed; BLOCKED is a placeholder guess)
2. Area type (carpet/saleable/super/chargeable)
3. Financial year vs calendar year convention
4. Whether "Floor" is a meaningful drill level for this data
5. Whether customer/transaction detail exists in the source report
