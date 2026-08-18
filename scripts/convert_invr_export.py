"""
Converts an INVR "Merged"-sheet export into the RawInventoryDataset JSON
schema the Inventory page expects (src/data/smartworldInventory.json).

Re-run this whenever a fresh INVR export replaces the current one. Update
SOURCE_XLSX below to point at the new file's path first.

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
import re
import pandas as pd

SOURCE_XLSX = "/mnt/user-data/uploads/INVR-All_Project_18-8-2026.xlsx"
OUTPUT_JSON = "/home/claude/DASHBOARD_SWD/src/data/smartworldInventory.json"

df = pd.read_excel(SOURCE_XLSX, sheet_name="Merged")

# ---- Lookup tables, built in a stable, sorted order ----
projects = sorted(df["Project Name"].unique().tolist())
towers = sorted(df["Tower"].unique().tolist())
floors_raw = df["Floor"].unique().tolist()


def floor_num(label: str) -> float:
    """Numeric floor value for sorting/banding. Verified against all 55
    distinct floor labels in this source with zero unparsed rows."""
    s = str(label).strip()
    sl = s.lower()
    if sl == "ground floor":
        return 0.0
    if sl == "upper ground floor":
        return 0.5
    if sl == "second floor":
        # Le Courtyard's SF- tower level (mezzanine/retail, above ground) -
        # distinct from the ordinal "2nd Floor".
        return 1.5
    m = re.match(r"(\d+)-a\s*floor", sl)
    if m:
        return int(m.group(1)) + 0.5
    m = re.match(r"(\d+)", sl)
    if m:
        return float(m.group(1))
    raise ValueError(f"Unparsed floor label: {label!r}")


# Sort floor labels by their numeric value for a stable FL[] index order.
floors = sorted(floors_raw, key=floor_num)


def derive_cfg(bhk_text: str) -> str:
    """Derive a clean configuration bucket from the free-text BHK column.
    Verified against all 50 distinct BHK values in this source with zero
    'Unspecified' fallback rows."""
    text = str(bhk_text).upper()
    if "RETAIL SHOP" in text or "SHOP" in text:
        return "Commercial"
    m = re.search(r"(\d+)\s*BHK", text)
    if m:
        return f"{m.group(1)} BHK"
    raise ValueError(f"Unparsed BHK value: {bhk_text!r}")


df["_cfg"] = df["BHK"].apply(derive_cfg)
cfgs = sorted(df["_cfg"].unique().tolist(), key=lambda c: (c == "Commercial", c))

unit_types = sorted(df["Unit Type"].unique().tolist())

# Status mapping: 0 Available, 1 Booked, 2 Management (includes "N/A for Sale").
def status_code_for(status_text: str) -> int:
    """0 Available, 1 Booked, 2 Management — anything that isn't
    literally "Available" or "Booked" folds into Management, per
    standing rule #2 above. This is deliberately permissive so a future
    export introducing yet another status string (not just
    "Management Unit" / "N/A for Sale") doesn't need code changes."""
    s = str(status_text).strip().lower()
    if s == "available":
        return 0
    if s == "booked":
        return 1
    return 2


project_idx = {p: i for i, p in enumerate(projects)}
tower_idx = {t: i for i, t in enumerate(towers)}
floor_idx = {f: i for i, f in enumerate(floors)}
cfg_idx = {c: i for i, c in enumerate(cfgs)}
unit_type_idx = {u: i for i, u in enumerate(unit_types)}

units = []
for _, row in df.iterrows():
    status_code = status_code_for(row["Status"])
    # Management sub-category: fold everything into bucket 2 ("Management
    # unit") since this source doesn't distinguish on-hold vs in-progress.
    mgmt_sub = 2 if status_code == 2 else 0

    units.append(
        [
            project_idx[row["Project Name"]],
            tower_idx[row["Tower"]],
            floor_num(row["Floor"]),
            floor_idx[row["Floor"]],
            cfg_idx[row["_cfg"]],
            unit_type_idx[row["Unit Type"]],
            int(row["Total Super Area"]),
            float(row["Total Unit Cost"]),
            status_code,
            mgmt_sub,
            -1,  # payment plan index - no source column
            0,   # rate band index - no source column, unused (see SwDrawer.tsx)
            str(row["Unit Description"]),
        ]
    )

dataset = {
    "P": projects,
    "TW": towers,
    "FL": floors,
    "CFG": cfgs,
    "UT": unit_types,
    "PP": [],
    "RB": [],
    "U": units,
    "HY": {
        "rows_in": len(df),
        "rows_out": len(units),
        "source_file": "INVR-All_Project_18-8-2026.xlsx",
        "projects_included": len(projects),
    },
}

with open(OUTPUT_JSON, "w") as f:
    json.dump(dataset, f)

print(f"Wrote {len(units)} units across {len(projects)} projects to {OUTPUT_JSON}")
print("Projects:", projects)
print("Configs:", cfgs)
print("Unit types:", unit_types)
