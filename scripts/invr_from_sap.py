#!/usr/bin/env python3
"""Refresh the Inventory data (src/data/smartworldInventory.json) from SAP Production.

Normal flow (server .28), same as the bookings refresh:
  VendorGlobe API (app/pdrn_sync.py, feed "invr") loads ZSD_INVR from SAP into SQL
  PDRN.dbo.SAP_INVR at 13:00 and 17:00 (only with VG_INVR_ENABLED=1 in the API's pdrn.env)
  -> this script reads that snapshot through http://127.0.0.1:5002/invr/rows -> maps the SAP fields
  to the INVR Excel column names -> build_invr (the SAME code as the Excel upload) -> build_tva.py
  (which first makes the INVR booking status follow the PDRN, see sync_inventory_with_pdrn.py).
  scripts/refresh_pdrn_live.ps1 runs it before the PDRN refresh, every 10 min 13:10-19:10.

Exit codes: 0 rebuilt · 3 nothing new (same SQL load already built, or the API has no INVR load
yet) · 1 failed (nothing written, the dashboard keeps its last inventory).

Checks before anything is written: every SAP field below still exists, every unit has a project,
unit no. and status, Tower/Floor/BHK/Unit Type are filled (or repairable), floors and BHK texts are
known, and the unit count is >= VG_INVR_MIN_RATIO (default 0.9) of the current dataset.

Settings (pdrn.env in the dashboard folder, optional):
  VG_INVR_API_URL    default http://127.0.0.1:5002/invr/rows ; VG_PDRN_API_TOKEN (remote API only)
  VG_INVR_MIN_RATIO  default 0.9

Usage
  python scripts/invr_from_sap.py            refresh (exit 3 = nothing new)
  python scripts/invr_from_sap.py --force    rebuild even if the SQL load is the same
  python scripts/invr_from_sap.py --check    read + validate + show field fill rates, write nothing
"""
import datetime
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_invr  # noqa: E402
from pdrn_from_sap import load_env_file, env, clean_text, clean_num, rows_of, ENV_FILE  # noqa: E402

DEFAULT_API = "http://127.0.0.1:5002/invr/rows"

# INVR Excel column  <-  ZSD_INVR service field (technical name of the same ALV column)
TEXT = {
    "Project Name": "NAME1",
    "Unit Description": "MAKTX",
    "Status": "VMSTB",
    "Unit Type": "BEZEI1",
    "Floor": "BEZEI4",
    "BHK": "BEZEI5",
    "Tower": "BEZEI2",
}
NUM = {
    "Total Super Area": "TOTAL_SUPER_AREA",
    "Total Unit Cost": "LV_SUM",
}


def to_unit(r):
    u = {col: clean_text(r.get(f)) for col, f in TEXT.items()}
    # blank amounts arrive as 0 in the Excel export too
    u.update({col: clean_num(r.get(f)) or 0.0 for col, f in NUM.items()})
    return u


def fetch_api():
    import requests
    url = env("VG_INVR_API_URL", DEFAULT_API)
    hdr = {"Accept": "application/json"}
    if env("VG_PDRN_API_TOKEN"):
        hdr["X-PDRN-Token"] = env("VG_PDRN_API_TOKEN")
    r = requests.get(url, headers=hdr, timeout=300)
    if r.status_code != 200:
        raise RuntimeError(f"{url} -> HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


def current():
    try:
        d = json.load(open(build_invr.OUT, encoding="utf-8"))
        return len(d["U"]), d.get("HY", {}).get("loadId")
    except Exception:
        return 0, None


def main(argv):
    if load_env_file():
        print(f"  settings from {os.path.abspath(ENV_FILE)}")
    check_only = "--check" in argv
    force = "--force" in argv

    ans = fetch_api()
    if not ans.get("rows"):
        print("  SQL table PDRN.dbo.SAP_INVR is empty - the API has not loaded INVR yet "
              "(VG_INVR_ENABLED=1 in C:\\VendorGlobe_API\\pdrn.env? see /invr/health). "
              "Inventory keeps its current data.")
        return 3
    load_id = ans.get("loadId")
    old_n, old_load = current()
    if load_id is not None and load_id == old_load and not force and not check_only:
        print(f"  INVR SQL load #{load_id} is already on the dashboard - nothing new")
        return 3
    raw = rows_of(ans)
    t = datetime.datetime.fromisoformat(ans["asOn"]) if ans.get("asOn") else datetime.datetime.now()
    loaded_iso = t.isoformat(timespec="seconds")
    as_on = f"{t:%d %b %Y}, {t:%I:%M %p}".replace(", 0", ", ")
    print(f"  INVR SQL snapshot #{load_id}: {len(raw)} units, loaded from SAP {as_on}")

    present = set().union(*(r.keys() for r in raw))
    gone = sorted(f for f in set(TEXT.values()) | set(NUM.values()) if f not in present)
    if gone:
        raise RuntimeError(f"ZSD_INVR no longer returns field(s) {gone} - report changed? "
                           f"Update the field map in scripts/invr_from_sap.py. Not loading.")
    units = [to_unit(r) for r in raw]

    # fill rates - so a PRD master-data gap is visible before it reaches the dashboard
    for col in list(TEXT) + list(NUM):
        empty = sum(1 for u in units if not u[col])
        print(f"    {col:<18} {len(units) - empty:>6} filled  {empty:>6} blank/0")
    st = {}
    for u in units:
        st[u["Status"]] = st.get(u["Status"], 0) + 1
    print("    status: " + ", ".join(f"{k} {v}" for k, v in sorted(st.items(), key=lambda x: -x[1])))

    bad = [u for u in units if not u["Project Name"] or not u["Unit Description"] or not u["Status"]]
    if bad:
        raise RuntimeError(f"{len(bad)} units without project / unit no. / status - not loading")

    units = build_invr.repair(units, log=lambda m: print("  " + m))   # raises if not repairable
    ratio = float(env("VG_INVR_MIN_RATIO", "0.9"))
    print(f"  {len(units)} units (dashboard has {old_n} now)")
    if old_n and len(units) < old_n * ratio:
        raise RuntimeError(f"units fell from {old_n} to {len(units)} (below {ratio:.0%}) - "
                           f"looks like incomplete data, not loading")
    # builds in memory first: unknown floor / BHK texts raise here, before anything is written
    build_invr.build([dict(u) for u in units], write=False, log=lambda m: None)
    if check_only:
        print("check OK - nothing written (--check)")
        return 0

    build_invr.build(units, {
        "rows_in": len(raw),
        "rows_out": len(units),
        "source_file": "SAP live (ZSD_INVR via SQL PDRN.dbo.SAP_INVR)",
        "loadId": load_id,
        "loadedAt": loaded_iso,
    }, log=lambda m: print("  " + m))
    build_invr.set_data_info(as_on, loaded_iso)
    subprocess.run([sys.executable, os.path.join(HERE, "build_tva.py")], check=True)
    print(f"INVR refreshed live from SAP - data as on {as_on}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except SystemExit:
        raise
    except Exception as e:  # keep the last good data
        print(f"INVR live refresh FAILED - Inventory keeps its last data. Reason: {e}")
        sys.exit(1)
