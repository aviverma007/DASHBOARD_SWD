# Data Dictionary

Maps business/source fields to internal fields used by the calculation and
presentation layers. **Not yet finalized** — awaiting real SAP/Excel reports
and field mappings from Anirudh. Do not treat any row below as confirmed.

| Business Field | Internal Field | Type    | Source | Required | Description                                   |
|-----------------|-----------------|---------|--------|----------|------------------------------------------------|
| Project Code/Name | `project_id`  | string  | SAP    | Yes      | Unique project identifier                     |
| Tower           | `tower_id`     | string  | SAP    | For tower drill-down | Tower within project                |
| Floor           | `floor_id`     | string  | SAP    | For floor drill-down | Floor within tower — level may be dropped if not meaningful |
| Unit ID          | `unit_id`      | string  | SAP    | Yes      | Unique inventory unit                          |
| Sales Status     | `sales_status` | enum    | SAP    | Yes      | Values unconfirmed — SOLD/UNSOLD assumed, BLOCKED is a guess |
| Area             | `area`         | decimal | SAP    | Yes      | Area value — unit/type (carpet/saleable/super) unconfirmed |
| Booking Date     | `booking_date` | date    | SAP    | For period trend | Used for period-over-period comparison |
| Customer/Booking Ref | `customer_id` | string | SAP  | Only if unit-level drill needs customer detail | May not exist in source report |

## Validation States

Every imported row is assigned one of:

- `Valid`
- `Warning`
- `Invalid`
- `Missing mapping`
- `Duplicate`
- `Excluded`

No KPI calculation runs on rows in `Invalid`, `Missing mapping`, `Duplicate`,
or `Excluded` states — they are shown in a separate validation report instead
of being silently dropped or silently included.
