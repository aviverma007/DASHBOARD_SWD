#!/usr/bin/env python3
"""Build src/data/sapPrStatus.json from an SE16N export of table EBAN (all fields or at least:
Purchase Requisition, Deletion indicator, Closed, Purchase order, Release indicator,
Purchase requisition processing state (BANPR), Changed On).

Usage: python3 scripts/build_sap_pr_status.py <eban.xlsx> ["<DD Mon YYYY>"]

The live SAP OData PR feed has no rejected / closed flag (its Procstat is blank, RelStatus always
PENDING), so PRs rejected in the release strategy look "awaiting SAP approval" for ever.
This file carries SAP's own end state per PR, for PRs WITHOUT a purchase order:
  Rejected   every live line has BANPR = 8 (release refused)
  Closed     every live line has EBAKZ = X
  Deleted    every line has LOEKZ = X
Refresh it with a new EBAN export until the ABAPer maps BANPR into PR_DATASet.Procstat.
"""
import sys, os, json, datetime
import pandas as pd

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "sapPrStatus.json")


def main(src, as_on=None):
    df = pd.read_excel(src)
    need = {"Purchase Requisition", "Deletion indicator", "Closed", "Purchase order",
            "Purchase requisition processing state"}
    miss = need - set(df.columns)
    if miss:
        sys.exit(f"missing EBAN columns: {sorted(miss)}")
    df = pd.DataFrame({
        "pr": df["Purchase Requisition"].astype(str).str.strip(),
        "dele": df["Deletion indicator"].eq("X"),
        "cls": df["Closed"].eq("X"),
        "po": df["Purchase order"].notna() & df["Purchase order"].astype(str).str.strip().ne(""),
        "banpr": df["Purchase requisition processing state"].astype(str).str.strip().str.lstrip("0"),
        "chg": pd.to_datetime(df.get("Changed On"), errors="coerce"),
    })
    out, counts = {}, {}
    for pr, g in df.groupby("pr"):
        live = g[~g["dele"]]
        if live["po"].any():
            continue
        if g["dele"].all():
            st = "Deleted"
        elif (live["banpr"] == "8").all():
            st = "Rejected"
        elif live["cls"].all():
            st = "Closed"
        else:
            continue
        chg = g["chg"].max()
        out[pr] = [st, chg.strftime("%Y-%m-%d") if pd.notna(chg) else ""]
        counts[st] = counts.get(st, 0) + 1
    as_on = as_on or datetime.date.today().strftime("%d %b %Y")
    json.dump({"meta": {"asOn": as_on, "source": os.path.basename(src), "counts": counts,
                        "fields": "R = {PR: [state, changedOn]}"}, "R": out},
              open(OUT, "w"), separators=(",", ":"))
    print(f"{len(out)} PRs with an SAP end state ({counts}), as on {as_on}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
