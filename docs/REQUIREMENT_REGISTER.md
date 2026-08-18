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

## REQ-002 (placeholder modules)

- **Module:** Sales, Collections, Revenue, Customers, Projects, Reports, Data Upload, Settings
- **Requirement:** Not yet specified
- **Status:** Placeholder — renders "coming soon" state, no logic built
- **Open Questions:** Awaiting requirements for each module
