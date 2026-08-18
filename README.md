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
- ✅ Inventory Overview page — Sold/Unsold/Total KPI cards, project comparison
  chart, project breakup table
- ✅ Global filters — Group, Project (multi-select/All), Period (M/Q/Y)
- ✅ Cross-filtering — clicking a chart bar or table row filters the dashboard
- ✅ Drill-down drawer — Group → Project → Tower → Floor → Unit → Customer,
  with breadcrumbs, fullscreen toggle, and per-level export buttons (UI only)
- ⏳ Placeholder modules: Sales, Collections, Revenue, Customers, Projects,
  Reports, Data Upload, Settings — awaiting requirements
- ⏳ Real Excel/PDF export (buttons present, not yet wired)
- ⏳ Data upload + validation workflow
- ⏳ Real backend / SAP data integration

**All data is currently mock/synthetic** — see `src/data/mockData.ts`. Nothing
in this build should be treated as real inventory figures.

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
