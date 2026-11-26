"""
Builds src/data/smartworldInventory.json (the RawInventoryDataset the Inventory page reads) from a
list of INVR units. Pure Python (no pandas) so it runs on server .28's embedded Python.

Used by
  scripts/convert_invr_export.py   Excel "Merged" INVR export  (manual upload)
  scripts/invr_from_sap.py         live SAP ZSD_INVR via SQL PDRN.dbo.SAP_INVR (1 PM / 5 PM)

Each unit is a dict keyed by the INVR Excel column names:
  Project Name, Tower, Floor, BHK, Unit Type, Total Super Area, Total Unit Cost, Status,
  Unit Description

Standing rules (confirmed by the user, 18 Aug 2026):
1. Only the projects present in the input are kept - fewer projects in, fewer projects out.
2. Any status that isn't "Available" or "Booked" (Management Unit, N/A for Sale, Reserved,
   In Progress ...) is folded into Management (status code 2).
3. Configuration buckets (CFG) are derived fresh from the BHK text every run; an unparsable BHK
   or floor label stops the build (ValueError) instead of a silent "Unspecified" bucket.

PP/RB stay empty and unit[10]/unit[11] are -1/0 - positional placeholders (no payment plan /
rate band source column; see SwDrawer.tsx).
"""
import json
import os
import re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "data", "smartworldInventory.json")
DATA_INFO = os.path.join(HERE, "..", "src", "config", "dataInfo.ts")
ATTRS = ("Tower", "Floor", "BHK", "Unit Type")


def _blank(v):
    if v is None:
        return True
    if isinstance(v, float) and v != v:          # NaN from pandas
        return True
    return False


def floor_num(label):
    """Numeric floor value for sorting/banding."""
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


def derive_cfg(bhk_text):
    """Clean configuration bucket from the free-text BHK column."""
    text = str(bhk_text).upper()
    if "RETAIL SHOP" in text or "SHOP" in text or "ANCHOR STORE" in text or "RESTAURANT" in text:
        # ONE DXP STREET "Anchor Store" / "Restaurant" - retail commercial space like the shops.
        return "Commercial"
    m = re.search(r"(\d+)\s*BHK", text)
    if m:
        return f"{m.group(1)} BHK"
    raise ValueError(f"Unparsed BHK value: {bhk_text!r}")


def status_code_for(status_text):
    """0 Available, 1 Booked, 2 Management (everything else, rule 2)."""
    s = str(status_text).strip().lower()
    if s == "available":
        return 0
    if s == "booked":
        return 1
    return 2


def _mode(values):
    """pandas Series.mode().iloc[0]: most frequent, smallest on a tie."""
    c = Counter(values)
    top = max(c.values())
    return sorted(v for v, n in c.items() if n == top)[0]


def _unique(seq):
    seen, out = set(), []
    for v in seq:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def repair(units, log=print):
    """Drops blank phantom duplicates and fills blank Tower/Floor/BHK/Unit Type from the unit
    number + sibling units. Anything that cannot be repaired raises ValueError."""
    # phantom: blank attributes, but the same project+unit also exists as a complete row
    blank = [any(_blank(u.get(a)) for a in ATTRS) for u in units]
    complete = {(u["Project Name"], u["Unit Description"]) for u, b in zip(units, blank) if not b}
    keep = []
    for u, b in zip(units, blank):
        if b and (u["Project Name"], u["Unit Description"]) in complete:
            log(f"Dropping blank duplicate row: {u['Unit Description']}")
            continue
        keep.append(u)
    units = keep

    # blank attributes: "T14-1704" -> tower T14, floor 17; BHK / unit type from same-area siblings
    miss = [any(_blank(u.get(a)) for a in ATTRS) for u in units]
    sound = [u for u, m in zip(units, miss) if not m]
    for u, m in zip(units, miss):
        if not m:
            continue
        mt = re.match(r"^(T\d+)-(\d+?)(\d{2})$", str(u["Unit Description"]))
        if not mt:
            raise ValueError(f"Cannot repair unit {u['Unit Description']!r} "
                             f"({u['Project Name']}): blank Tower/Floor/BHK/Unit Type")
        fl = int(mt.group(2))
        suf = "th" if 10 <= fl % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(fl % 10, "th")
        sib = [s for s in sound if s["Project Name"] == u["Project Name"]
               and s["Total Super Area"] == u["Total Super Area"]]
        if not sib:
            raise ValueError(f"No sibling units to infer BHK for {u['Unit Description']!r}")
        u["Tower"] = mt.group(1)
        u["Floor"] = f"{fl}{suf} Floor"
        u["BHK"] = _mode([s["BHK"] for s in sib])
        u["Unit Type"] = _mode([s["Unit Type"] for s in sib])
        log(f"Repaired blank-attribute unit: {u['Unit Description']} -> "
            f"{u['Tower']} {u['Floor']} {u['BHK']} {u['Unit Type']}")
    return units


def build(units, hy_extra=None, log=print, write=True):
    """units: list of dicts (see module doc), already repaired. Returns the dataset dict and
    writes smartworldInventory.json when write=True."""
    for u in units:
        # Oct 2026 exports switched to mixed-case names; the PDRN<->INVR join needs ALL CAPS
        u["Project Name"] = str(u["Project Name"]).upper()
        u["_cfg"] = derive_cfg(u["BHK"])

    projects = sorted(_unique(u["Project Name"] for u in units))
    towers = sorted(_unique(u["Tower"] for u in units))
    floors = sorted(_unique(u["Floor"] for u in units), key=floor_num)
    cfgs = sorted(_unique(u["_cfg"] for u in units), key=lambda c: (c == "Commercial", c))
    unit_types = sorted(_unique(u["Unit Type"] for u in units))

    p_i = {p: i for i, p in enumerate(projects)}
    t_i = {t: i for i, t in enumerate(towers)}
    f_i = {f: i for i, f in enumerate(floors)}
    c_i = {c: i for i, c in enumerate(cfgs)}
    ut_i = {x: i for i, x in enumerate(unit_types)}

    rows = []
    for u in units:
        sc = status_code_for(u["Status"])
        rows.append([
            p_i[u["Project Name"]],
            t_i[u["Tower"]],
            floor_num(u["Floor"]),
            f_i[u["Floor"]],
            c_i[u["_cfg"]],
            ut_i[u["Unit Type"]],
            int(u["Total Super Area"]),
            float(u["Total Unit Cost"]),
            sc,
            2 if sc == 2 else 0,     # management sub-category: one bucket ("Management unit")
            -1,                      # payment plan index - no source column
            0,                       # rate band index - no source column
            str(u["Unit Description"]),
        ])
    for u in units:
        u.pop("_cfg", None)

    dataset = {"P": projects, "TW": towers, "FL": floors, "CFG": cfgs, "UT": unit_types,
               "PP": [], "RB": [], "U": rows, "HY": dict(hy_extra or {})}
    dataset["HY"].setdefault("rows_out", len(rows))
    dataset["HY"].setdefault("projects_included", len(projects))
    if write:
        with open(OUT, "w") as f:
            json.dump(dataset, f)
        log(f"Wrote {len(rows)} units across {len(projects)} projects to {os.path.abspath(OUT)}")
        log(f"Projects: {projects}")
        log(f"Configs: {cfgs}")
        log(f"Unit types: {unit_types}")
    return dataset


def set_data_info(as_on, loaded_iso):
    """INVR_AS_ON / INVR_LIVE / INVR_LOADED_ISO in src/config/dataInfo.ts (Inventory page badge)."""
    with open(DATA_INFO, encoding="utf-8") as fh:
        t = fh.read()
    t = re.sub(r'export const INVR_AS_ON = ".*?";', f'export const INVR_AS_ON = "{as_on}";', t)
    t = re.sub(r'export const INVR_LIVE = \w+;',
               f'export const INVR_LIVE = {"true" if loaded_iso else "false"};', t)
    t = re.sub(r'export const INVR_LOADED_ISO = ".*?";',
               f'export const INVR_LOADED_ISO = "{loaded_iso or ""}";', t)
    with open(DATA_INFO, "w", encoding="utf-8") as fh:
        fh.write(t)
