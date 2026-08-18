# Calculation Dictionary

Single source of truth for KPI formulas. Implemented in
`src/utils/calculations.ts` — that file and this document must stay in sync.
Do not duplicate this logic elsewhere in the codebase.

---

## KPI: Sold Units

**Definition:** Unique count of inventory units classified as Sold.

**Formula:**
```
COUNT DISTINCT(unit_id) WHERE sales_status = 'SOLD'
```

**Dimensions:** Project, Period, Tower, Floor

**Source:** SAP Inventory / Sales Report (mock data currently)

**Validation:** `unit_id` must not be blank. `sales_status` must map to the
approved status master (not yet confirmed).

---

## KPI: Unsold Units

**Definition:** Unique count of inventory units classified as Unsold.

**Formula:**
```
COUNT DISTINCT(unit_id) WHERE sales_status = 'UNSOLD'
```

Dimensions, source, and validation same as Sold Units.

---

## KPI: Total Units

**Definition:** Sold Units + Unsold Units. This is a locked identity —
Total is never independently sourced or recalculated a different way.

**Formula:**
```
Total Units = Sold Units + Unsold Units
```

**Note on BLOCKED/HOLD units:** any unit with a status other than SOLD or
UNSOLD (e.g. an assumed BLOCKED state) is excluded from Total rather than
folded into either bucket. This is surfaced separately in the UI and needs
explicit confirmation once real status values are known.

---

## KPI: Sold % / Unsold %

**Formula:**
```
Sold %   = Sold Units / Total Units × 100
Unsold % = Unsold Units / Total Units × 100
```

---

## Area KPIs (Sold Area, Unsold Area, Total Area, Sold Area %)

Mirror the unit formulas using `SUM(area)` instead of `COUNT DISTINCT(unit_id)`.

**Open question:** which area type (carpet/saleable/super/chargeable) the
source data uses. Kept as a configurable field (`areaType` on the `Unit`
type) rather than hardcoded until confirmed.

---

## Project Contribution %

**Definition:** Each project's share of the group-level total.

**Formula:**
```
Contribution % = Project Total Units / Group Total Units × 100
```

---

## Period-over-Period Change

**Formula:**
```
Change % = (Current Period Value − Previous Period Value) / Previous Period Value × 100
```

Only calculated when a previous-period value is available; otherwise the UI
omits the comparison rather than showing a misleading 0%.
