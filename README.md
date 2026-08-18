# DASHBOARD_SWD

Real-estate project analytics BI dashboard for Smart World Developers —
Inventory / Sales Overview with Sold/Unsold/Total KPIs and drill-down
navigation from Group → Project → Tower → Floor → Unit → Customer.

This is **Phase 2/3** of an incremental build. See `docs/` for the living
requirement register, data dictionary, and calculation dictionary — these
are updated as real SAP/Excel data and field mappings are confirmed.

## Status

- ✅ Login (demo auth — see `src/store/authStore.ts`)
- ✅ Responsive app shell (sidebar, header, mobile drawer nav)
- ✅ **Inventory page — direct port of the reference sales-intelligence
  tool**, built on real data — currently 3,386 units across 6 Smartworld
  projects. Routed at `/` and `/inventory`. See "Inventory module" below
  for what this covers.
- ⏳ Placeholder modules: Sales, Collections, Revenue, Customers, Projects,
  Reports, Data Upload, Settings — awaiting requirements
- ⏳ Real Excel/PDF export
- ⏳ Data upload + validation workflow
- ⏳ Backend/live SAP sync (current data is a static bundled snapshot)

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
Value available/Value booked), Stock status + By category donuts,
Availability-by-project + Unsold-value-by-project bars, Config gap
analysis matrix, By configuration / Floor rise / By size band / By price
band / By unit type group-bar cards, searchable paginated unit records
table, Management-units-by-project table (shown when Status = Management).

**Drawer:** breadcrumb trail, insight line, drawer KPIs, stock-status
donut, then contextual drill content depending on depth (project → tower
ranking + stack plan + config/floor/size/price bars; tower → floor list +
config bars; group/status scope → by-project + by-config bars), plus its
own unit records list. Clicking a stack-plan square or table row opens a
full unit detail view (project/tower/floor/config/area/cost/rate/payment
plan) with a "back to list" button.

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
    filters/             # ProjectFilter, PeriodFilter, FilterBar
    kpi/                 # KpiCard, KpiStrip
    charts/              # ProjectComparisonChart
    tables/              # ProjectBreakupTable
    drilldown/           # DrilldownDrawer, DrilldownContent
    common/              # EmptyState, SkeletonBlock, ComingSoon
  features/
    authentication/      # LoginPage, RequireAuth
    inventory/           # InventoryOverviewPage
    sales/ projects/ reports/  # reserved for future modules
  services/              # inventoryService.ts — mock now, real API later
  store/                 # filterStore, drilldownStore, authStore (Zustand)
  types/                 # domain.ts, filters.ts
  utils/                 # calculations.ts (KPI math), format.ts
  config/                # navigation.ts, filterDimensions.ts
  data/                  # mockData.ts — clearly labeled synthetic data
docs/
  REQUIREMENT_REGISTER.md
  DATA_DICTIONARY.md
  CALCULATION_DICTIONARY.md
```

Components never read `mockData.ts` or call calculation functions directly —
they go through `services/inventoryService.ts`. Swapping mock data for a
real backend means changing that one file.

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
