#!/usr/bin/env python3
"""Cost pages live from SAP ZALR (Budget Vs Actual):
  Non-Project  src/data/costNonProject.json  <- Item Wise PO + Summary + Total Actual, FY 2024 -> now
  Project      src/data/costProject.json     <- Project run, every Project definition, project to date

  VendorGlobe API (app/pdrn_sync.py) loads /sap/zalr into SQL PDRN.dbo.SAP_ZALR_NP (feed zalr_np,
  CALL_KEY = view) and PDRN.dbo.SAP_ZALR_PJ (feed zalr_pj, CALL_KEY = project definition) at
  13:00/17:00 -> this script writes the SAME Excel files the manual ZALR exports were (ALV headings in
  ZALR order, real dates and amounts) -> runs build_cost_np.py / build_cost_pj.py UNCHANGED.

Project "Expense" head: SAP's ZALR does not return the manual Expense column, so it comes from the
CN41 WBS hierarchy (src/data/costMaster.json): the level-4 WBS name ("Civil Works", "MEP works" ...),
with tower / area prefixes removed ("T11-Finishing Works" -> "Finishing Works"), "Common Expense" for
everything under a Common Expense level-3 node; build_cost_pj.expense_head() then merges spellings.

Needs pandas on the server (the cost builders use it): python -m pip install pandas
Exit codes: 0 rebuilt · 3 nothing new · 1 failed (nothing written).
Usage: python scripts/cost_from_sap.py [np|pj] [--force] [--check]
"""
import datetime
import json
import os
import re
import sys
import tempfile
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sap_live as sl  # noqa: E402

# ZALR_PROG2 FORM create_fcat_alv, evaluated per view (heading, field, kind)
LAYOUTS = {
    'np_po': [
        ('WBS', 'PSPNR', 't'),
        ('WBS Description', 'POST1', 't'),
        ('Profit Center', 'PRCTR', 'i'),
        ('Business Area', 'PGSBR', 't'),
        ('Plant_WBS', 'WERKS', 't'),
        ('Plant Name', 'NAME1', 't'),
        ('Purchasing Group', 'EKGRP', 't'),
        ('P.Grp Name', 'EKNAM', 't'),
        ('Vendor Name', 'V_NAME', 't'),
        ('Purchasing Document', 'EBELN', 't'),
        ('Item No.', 'EBELP', 'i'),
        ('Plant', 'PO_WERKS', 't'),
        ('Plant Description', 'NAME1_PO', 't'),
        ('Company Code', 'BUKRS', 't'),
        ('Company Description', 'BUTXT', 't'),
        ('GL Code', 'RACCT', 'i'),
        ('GL Code Description', 'TXT50', 't'),
        ('Document Date', 'BEDAT', 'd'),
        ('Short Text', 'TXZ01', 't'),
        ('UOM', 'UNIT', 't'),
        ('Quantity', 'MENGE', 'n'),
        ('Net Price', 'NETPR', 'n'),
        ('Ordered Value', 'ORD_EXC', 'n'),
        ('Ordered with GST', 'ORD_INC', 'n'),
        ('Delivered Value', 'DEL_VALUE', 'n'),
        ('Basic Delivered Value', 'DEL_EXC', 'n'),
        ('Delivered Value with GST', 'DEL_INC', 'n'),
        ('Still to be Delivered Value', 'STD_EXC', 'n'),
        ('Still to be Invoiced Value', 'STI_EXC', 'n'),
        ('Document Type', 'BSART', 't'),
        ('Validity Start Date', 'KDATB', 'd'),
        ('Validity End Date', 'KDATE', 'd'),
    ],
    'np_summary': [
        ('Project Definition', 'PROJ_DEF', 't'),
        ('Project Description', 'PROJ_DESC', 't'),
        ('Budget Head', 'LVL2_WBS', 't'),
        ('Budget Head Description', 'LVL2_DESC', 't'),
        ('WBS', 'PSPNR', 't'),
        ('WBS Description', 'POST1', 't'),
        ('Profit Center', 'PRCTR', 'i'),
        ('Business Area', 'PGSBR', 't'),
        ('Plant_WBS', 'WERKS', 't'),
        ('Plant Name', 'NAME1', 't'),
        ('Budget', 'O_BUDGET', 'n'),
        ('Basic Budget', 'O_BUDGET_BASIC', 'n'),
        ('Total Actual', 'O_ACT', 'n'),
        ('Asset PO Actual', 'ASSET_ACTUAL', 'n'),
        ('Total Actual with Asset', 'ACT_WITH_ASSET', 'n'),
        ('Basic Asset PO Actual', 'ASSET_ACTUAL_BASIC', 'n'),
        ('Basic Total Actual with Asset', 'ACT_ASSET_BASIC', 'n'),
        ('Basic Total Actual', 'O_ACT_BASIC', 'n'),
        ('Assigned', 'O_ASSI', 'n'),
        ('Basic Assigned', 'O_ASSI_BASIC', 'n'),
        ('Commitment', 'O_COMIT', 'n'),
        ('Basic Commitment', 'O_COMIT_BASIC', 'n'),
        ('Budget Available', 'O_AVAIL', 'n'),
        ('Basic Available Budget', 'O_AVAIL_BASIC', 'n'),
        ('Actual Non-PO', 'NON_PO', 'n'),
        ('Actual Reversal', 'REV_PO', 'n'),
        ('Actual PO Sum', 'ACT_PO', 'n'),
        ('Purchasing Group', 'EKGRP', 't'),
        ('P.Grp Name', 'EKNAM', 't'),
    ],
    'np_total_actual': [
        ('WBS', 'PSPNR', 't'),
        ('WBS Description', 'POST1', 't'),
        ('Purchasing Group', 'EKGRP', 't'),
        ('PG Name', 'EKNAM', 't'),
        ('Vendor/Supplier', 'LIFNR', 'i'),
        ('Vendor Name', 'V_NAME', 't'),
        ('Document Type', 'BLART', 't'),
        ('Document No.', 'BELNR', 't'),
        ('Document Date', 'BLDAT', 'd'),
        ('PO No.', 'EBELN', 't'),
        ('Item No.', 'EBELP', 'i'),
        ('Header Text', 'BKTXT', 't'),
        ('Posting Date', 'BUDAT', 'd'),
        ('Total Actual Amount', 'HSL', 'n'),
        ('GL Code', 'RACCT', 'i'),
        ('GL Code Description', 'TXT50', 't'),
        ('Assignment', 'ZUONR', 't'),
        ('Ref. Text', 'SGTXT', 't'),
        ('Profit Center', 'PRCTR_R', 'i'),
        ('Bus.Transaction', 'VRGNG', 't'),
        ('Tax Code', 'MWSKZ', 't'),
        ('Basic Value', 'BASIC', 'n'),
        ('Tax Value', 'TAX_AMT', 'n'),
        ('Total With Tax Value', 'GST_AMT', 'n'),
        ('Year', 'GJAHR', 't'),
        ('Company Code', 'RBUKRS', 't'),
        ('Invoice No.', 'XBLNR', 't'),
        ('Company Name', 'BUTXT', 't'),
    ],
    'project': [
        ('WBS', 'PSPNR', 't'),
        ('WBS Description', 'POST1', 't'),
        ('Profit Center', 'PRCTR', 'i'),
        ('Business Area', 'PGSBR', 't'),
        ('Plant_WBS', 'WERKS', 't'),
        ('Plant Name', 'NAME1', 't'),
        ('Budget', 'O_BUDGET', 'n'),
        ('Total Actual', 'O_ACT', 'n'),
        ('Asset PO Actual', 'ASSET_ACTUAL', 'n'),
        ('Total Actual with Asset', 'ACT_WITH_ASSET', 'n'),
        ('Assigned', 'O_ASSI', 'n'),
        ('Commitment', 'O_COMIT', 'n'),
        ('Budget Available', 'O_AVAIL', 'n'),
        ('Actual Non-PO', 'NON_PO', 'n'),
        ('Actual Reversal', 'REV_PO', 'n'),
        ('Actual PO Sum', 'ACT_PO', 'n'),
        ('Vendor Name', 'V_NAME', 't'),
        ('Purchasing Document', 'EBELN', 't'),
        ('Item No.', 'EBELP', 'i'),
        ('GL Code', 'RACCT', 'i'),
        ('GL Code Description', 'TXT50', 't'),
        ('Document Date', 'BEDAT', 'd'),
        ('Short Text', 'TXZ01', 't'),
        ('UOM', 'UNIT', 't'),
        ('Quantity', 'MENGE', 'n'),
        ('Net Price', 'NETPR', 'n'),
        ('Ordered Value', 'ORD_EXC', 'n'),
        ('Ordered with GST', 'ORD_INC', 'n'),
        ('Delivered Value', 'DEL_EXC', 'n'),
        ('Delivered Value with GST', 'DEL_INC', 'n'),
        ('Still to be Delivered Value', 'STD_EXC', 'n'),
        ('Still to be Delivered with GST', 'STD_INC', 'n'),
        ('Still to be Invoiced Value', 'STI_EXC', 'n'),
        ('Still to be Invoiced with GST', 'STI_INC', 'n'),
        ('Invoiced Value', 'INV_EXC', 'n'),
        ('Invoiced Value with GST', 'INV_INC', 'n'),
        ('Document Type', 'BSART', 't'),
        ('Validity Start Date', 'KDATB', 'd'),
        ('Validity End Date', 'KDATE', 'd'),
    ],
}


def needed(layout, builder):
    """Fields whose ALV heading the builder reads (a renamed/removed one must stop the load)."""
    src = open(os.path.join(HERE, builder + ".py"), encoding="utf-8").read()
    return [(h, f, k) for h, f, k in layout if f'"{h}"' in src]


NP_FILES = [("np_po", "Item_Wise.xlsx"), ("np_summary", "Summary.xlsx"), ("np_total_actual", "Total_Actual.xlsx")]


# ---------------- Project "Expense" head from the CN41 master ----------------

def _master():
    nodes = json.load(open(os.path.join(sl.DATA, "costMaster.json"), encoding="utf-8"))["N"]
    by = {}
    for i, n in enumerate(nodes):
        c = by.get(n[0])
        if c is None or n[3] > nodes[c][3]:
            by[n[0]] = i
    return nodes, by


def _clean(t):
    t = re.sub(r"^(phase[- ]?\d+\s*\|\s*)?([A-Z0-9]{2,4}\s*-\s*)", "", str(t).strip(), flags=re.I)
    t = re.sub(r"(\s+-\s*|\s*-\s+).*$", "", t).strip()   # "Provisional Booking - Sky Arc" -> "Provisional Booking"
    l = t.lower()
    if l.startswith("external development"):
        return "External Development"
    if l.startswith("other expense"):
        return "Other Expenses"
    return t


def expense_from_master(wbs, nodes, by):
    c, i = wbs, None
    while True:                                   # nearest WBS that exists in the master
        if c in by:
            i = by[c]
            break
        if "-" not in c:
            return "—"
        c = c[:c.rfind("-")]
    chain = []
    while i is not None and i != -1:
        chain.append(nodes[i])
        i = nodes[i][2]
    if any(n[3] == 3 and n[1].strip().lower().startswith("common expense") for n in chain):
        return "Common Expense"
    lvl4 = next((n for n in chain if n[3] == 4), None)
    return _clean((lvl4 or chain[0])[1])


# ---------------- loads ----------------

def _counts(name):
    try:
        d = json.load(open(os.path.join(sl.DATA, name), encoding="utf-8"))
        return len(d["L"]) + len(d["B"])
    except Exception:
        return 0


def _guarded(name, build, ratio):
    """Run a builder; put the last good file back if it fails or the result shrank too much."""
    path = os.path.join(sl.DATA, name)
    old = open(path, "rb").read() if os.path.exists(path) else None
    old_n = _counts(name)
    try:
        build()
        new_n = _counts(name)
        if old_n and new_n < old_n * ratio:
            raise RuntimeError(f"{name}: lines+budgets fell from {old_n} to {new_n} (below {ratio:.0%})")
    except BaseException:
        if old is not None:
            open(path, "wb").write(old)
        raise


def _need_pandas():
    try:
        import pandas  # noqa: F401
    except ImportError:
        raise RuntimeError(f"pandas is not installed for {sys.executable} - run once in an admin "
                           f"PowerShell: & \"{sys.executable}\" -m pip install pandas")


def as_on_date(ans):
    t = datetime.datetime.fromisoformat(ans["asOn"]) if ans.get("asOn") else datetime.datetime.now()
    return t.strftime("%d %b %Y")


def load_np(force, check, ratio):
    ans = sl.fetch_rows("zalr_np")
    rows = ans["rows"]
    if not rows:
        print("  SQL table PDRN.dbo.SAP_ZALR_NP is empty - the API has not loaded it yet (see /zalr_np/health).")
        return 3
    load_id = ans.get("loadId")
    if load_id is not None and load_id == sl.json_meta("costNonProject.json").get("loadId") and not force and not check:
        print(f"  ZALR Non-Project SQL load #{load_id} is already on the dashboard - nothing new")
        return 3
    as_on, iso = sl.load_time(ans)
    by_view = {}
    for r in rows:
        # CALL_KEY "np_po HO1000-RE1040": view, then the definitions of that call
        by_view.setdefault((sl.to_text(r.get("CALL_KEY")) or "").split(" ")[0], []).append(r)
    print(f"  ZALR Non-Project SQL snapshot #{load_id}, loaded from SAP {as_on}: "
          + ", ".join(f"{v} {len(by_view.get(v, []))}" for v, _ in NP_FILES))
    for v, _ in NP_FILES:
        if not by_view.get(v):
            raise RuntimeError(f"view {v} has no rows - not loading")
        gone = sl.missing_fields(by_view[v], needed(LAYOUTS[v], "build_cost_np"))
        if gone:
            raise RuntimeError(f"ZALR {v} no longer returns {gone} - report changed? Not loading.")
    _need_pandas()
    if check:
        print("  Non-Project check OK - nothing written (--check)")
        return 0
    import build_cost_np
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for v, fn in NP_FILES:
            p = os.path.join(tmp, fn)
            sl.write_xlsx(p, LAYOUTS[v], by_view[v])
            paths.append(p)
        _guarded("costNonProject.json", lambda: build_cost_np.main(*paths, as_on_date(ans)), ratio)
    sl.patch_meta("costNonProject.json", loadId=load_id, loadedAt=iso,
                  source=f"SAP live (ZALR Non-Project via SQL PDRN.dbo.SAP_ZALR_NP, load #{load_id}, {as_on})")
    return 0


def load_pj(force, check, ratio):
    ans = sl.fetch_rows("zalr_pj")
    rows = ans["rows"]
    if not rows:
        print("  SQL table PDRN.dbo.SAP_ZALR_PJ is empty - the API has not loaded it yet (see /zalr_pj/health).")
        return 3
    load_id = ans.get("loadId")
    if load_id is not None and load_id == sl.json_meta("costProject.json").get("loadId") and not force and not check:
        print(f"  ZALR Project SQL load #{load_id} is already on the dashboard - nothing new")
        return 3
    as_on, iso = sl.load_time(ans)
    per = Counter(sl.to_text(r.get("CALL_KEY")) for r in rows)
    print(f"  ZALR Project SQL snapshot #{load_id}, loaded from SAP {as_on}: {len(rows)} rows, "
          f"{len(per)} project definitions ({', '.join(f'{k} {v}' for k, v in sorted(per.items()))})")
    gone = sl.missing_fields(rows, needed(LAYOUTS["project"], "build_cost_pj"))
    if gone:
        raise RuntimeError(f"ZALR project view no longer returns {gone} - report changed? Not loading.")
    nodes, by = _master()
    heads = {}
    for r in rows:
        w = sl.to_text(r.get("PSPNR")) or ""
        if w and w not in heads:
            heads[w] = expense_from_master(w, nodes, by)
        r["_EXPENSE"] = heads.get(w)
    top = Counter(heads.values()).most_common(8)
    print("  Expense heads from the CN41 hierarchy: " + ", ".join(f"{k} {v}" for k, v in top))
    _need_pandas()
    if check:
        print("  Project check OK - nothing written (--check)")
        return 0
    import build_cost_pj
    layout = LAYOUTS["project"][:1] + [("Expense", "_EXPENSE", "t")] + LAYOUTS["project"][1:]
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, "Merged_Project_ZALR.xlsx")
        sl.write_xlsx(p, layout, rows)
        _guarded("costProject.json", lambda: build_cost_pj.main(p, as_on_date(ans)), ratio)
    sl.patch_meta("costProject.json", loadId=load_id, loadedAt=iso,
                  source=f"SAP live (ZALR Project via SQL PDRN.dbo.SAP_ZALR_PJ, load #{load_id}, {as_on})")
    return 0


def main(argv):
    force, check = "--force" in argv, "--check" in argv
    parts = [a for a in argv if a in ("np", "pj")] or ["np", "pj"]
    ratio = float(sl.env("VG_ZALR_MIN_RATIO", "0.9"))
    codes, errors = {}, []
    for part, fn in (("np", load_np), ("pj", load_pj)):
        if part not in parts:
            continue
        try:
            codes[part] = fn(force, check, ratio)
        except Exception as e:                    # one part failing keeps the other
            print(f"  {'Non-Project' if part == 'np' else 'Project'} cost FAILED - keeps its last data: {e}")
            codes[part] = 1
            errors.append(part)
    if any(c == 0 for c in codes.values()) and not check:
        ans_t = max((sl.json_meta(n).get("loadedAt") or "" for n in ("costNonProject.json", "costProject.json")))
        if ans_t:
            t = datetime.datetime.fromisoformat(ans_t)
            sl.set_data_info("ZALR", f"{t:%d %b %Y}, {t:%I:%M %p}".replace(", 0", ", "), ans_t)
        print("Cost data refreshed live from SAP (" + ", ".join(f"{k} exit {v}" for k, v in codes.items()) + ")")
        return 0
    return 1 if errors else 3 if not check else 0


if __name__ == "__main__":
    sl.run(main)
