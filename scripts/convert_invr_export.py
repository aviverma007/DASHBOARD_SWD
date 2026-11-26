"""
Converts an INVR "Merged"-sheet export into the RawInventoryDataset JSON
schema the Inventory page expects (src/data/smartworldInventory.json).

Re-run this whenever a fresh INVR export replaces the current one:
    python scripts/convert_invr_export.py <path to export .xlsx>

Standing rules for every run (confirmed by the user, 18 Aug 2026):
1. Only the projects present in the uploaded file are kept — if the file
   covers fewer projects than the current dataset, the dashboard
   intentionally shrinks to match. This is not a bug to "fix" by
   preserving old projects.
2. Any status value that isn't "Available" or "Booked" (e.g. "N/A for
   Sale") is folded into Management (status code 2).
3. Configuration buckets (CFG) are derived fresh from whatever free-text
   configuration/BHK column the new export has — never carried over from
   a previous run's bucket list. Verify the parser against every distinct
   value in the new column before trusting its output (see the
   ValueError guards below); a silent "Unspecified" fallback defeats the
   point of deriving buckets in the first place.

This particular run's source had no Payment Plan or Rate Band columns,
so PP/RB are empty and unit[10]/unit[11] are always -1/0 — positional
placeholders only. If a future export does include those columns, this
script should populate them and SwDrawer.tsx's unit-detail view should
have its Payment Plan / Rate Band rows restored (see git history for the
last version that displayed them, before this run removed them).
"""
import json
import os
import re
import sys
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_invr  # noqa: E402

# Usage: python scripts/convert_invr_export.py <INVR export .xlsx>
if len(sys.argv) < 2:
    sys.exit("usage: convert_invr_export.py <INVR export .xlsx>")
SOURCE_XLSX = sys.argv[1]

df = pd.read_excel(SOURCE_XLSX, sheet_name="Sheet1")

# ---- Repair hand-appended rows with a column shift ----
# Manually added units sometimes arrive shifted right from "Unit
# Description" onward (05-Oct v2: one column, so the unit no. lands in
# Status; 14-Oct v2: one row shifted by one, another by two). Detect by
# unknown Status, find the shift k at which a known status appears one
# column after the unit description, and drop k cells at Unit
# Description. Guard stays strict: any OTHER anomaly still fails.
KNOWN_STATUS = {"Available", "Booked", "Management Unit", "In Progress", "N/A for Sale"}
_i_desc = list(df.columns).index("Unit Description")
_bad = ~df["Status"].astype(str).isin(KNOWN_STATUS)
if _bad.any():
    fixed_rows = []
    for ix in df.index[_bad]:
        vals = list(df.loc[ix])
        k = next((k for k in range(1, 4)
                  if all(pd.isna(v) or str(v).strip() in ("", "0") for v in vals[_i_desc:_i_desc + k])
                  and str(vals[_i_desc + k + 1]) in KNOWN_STATUS), None)
        if k is None:
            raise ValueError(f"Unrepairable row {ix}: Status={df.at[ix, 'Status']!r}")
        fixed_rows.append(vals[:_i_desc] + vals[_i_desc + k:] + [None] * k)
        print(f"Repairing row {ix} shifted by {k}: {vals[_i_desc + k]!r} -> {vals[_i_desc + k + 1]!r}")
    fixed = pd.DataFrame(fixed_rows, columns=df.columns)
    df = pd.concat([df[~_bad], fixed], ignore_index=True)

# ---- Everything after the Excel-specific column-shift repair is shared with the live SAP
# refresh (scripts/invr_from_sap.py): phantom-duplicate drop, blank-attribute repair, project
# name upper-casing, lookup tables, status/config mapping -> scripts/build_invr.py
COLS = ["Project Name", "Tower", "Floor", "BHK", "Unit Type", "Total Super Area",
        "Total Unit Cost", "Status", "Unit Description"]
units = [{c: (None if pd.isna(r[c]) else r[c]) for c in COLS} for _, r in df[COLS].iterrows()]
units = build_invr.repair(units)
build_invr.build(units, {
    "rows_in": len(df),
    "rows_out": len(units),
    "source_file": re.sub(r"^[0-9a-f]{8}-", "", os.path.basename(SOURCE_XLSX)),
    "projects_included": len({str(u["Project Name"]).upper() for u in units}),
})
# Excel upload -> the Inventory badge shows "data as on", not "Live from SAP"
build_invr.set_data_info(pd.Timestamp.now().strftime("%d %b %Y"), None)
