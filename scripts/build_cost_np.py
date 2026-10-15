#!/usr/bin/env python3
"""Build src/data/costNonProject.json from the three Non-Project FY exports.

Usage: python3 scripts/build_cost_np.py <Item_Wise.xlsx> <Summary.xlsx> <Total_Actual.xlsx> "<DD Mon YYYY>"

  Item_Wise   PO lines (ordered / delivered / still-to-deliver)      -> L
  Summary     per-WBS budget, assigned, actual, commitment, available -> B
              (company sub-total rows have no WBS and are skipped)
  Total_Actual GL postings; used to TIE OUT Summary actuals per WBS   -> meta.tieout

L = [wbs,wdesc,vend,pgrp,plant,gl,dtyp,comp,root,day,po,ord,ordGst,del,delGst,still,mapped]
    ord = Ordered Value (excl GST), ordGst = Ordered with GST, del = Basic Delivered Value,
    delGst = Delivered Value with GST, still = ord - del, mapped = WBS present in Summary.
B = [wbs,budget,basicBudget,assigned,basicAssigned,actual,basicActual,actualPO,actualNonPO,
     commitment,basicCommitment,available,basicAvailable,root,pgrp]
Day numbers are days since 2022-01-01 (-1 = none).
"""
import sys, json, datetime
import pandas as pd

OUT = "/home/claude/DASHBOARD_SWD/src/data/costNonProject.json"
EPOCH = datetime.datetime(2022, 1, 1)


def day(v):
    if pd.isna(v):
        return -1
    return (pd.Timestamp(v).to_pydatetime().replace(tzinfo=None) - EPOCH).days


def s(v, dash="—"):
    return dash if pd.isna(v) or str(v).strip() == "" else str(v).strip()


def main(iw_f, sm_f, ta_f, as_on):
    iw = pd.read_excel(iw_f); sm = pd.read_excel(sm_f); ta = pd.read_excel(ta_f)
    # SAP exports append a grand-total row (no WBS / PO / vendor) — drop it so nothing is double counted.
    iw = iw[iw["WBS"].notna() | iw["Purchasing Document"].notna()].copy()
    ta = ta[ta["WBS"].notna() | ta["Document No."].notna()].copy()
    smw = sm[sm["WBS"].notna()].copy()
    if smw["WBS"].duplicated().any():
        raise ValueError("Duplicate WBS in Summary: " + str(smw[smw.WBS.duplicated()].WBS.tolist()[:5]))
    root_of = dict(zip(smw["WBS"], smw["Project Description"].map(s)))

    lex = {k: {} for k in ["WBS", "WDESC", "VEND", "PGRP", "PLANT", "GL", "DTYP", "COMP", "ROOT"]}

    def ix(k, v):
        d = lex[k]
        if v not in d:
            d[v] = len(d)
        return d[v]

    L = []
    for r in iw.itertuples(index=False):
        w = s(r[iw.columns.get_loc("WBS")])
        g = lambda c: getattr(r, c.replace(" ", "_").replace(".", "_")) if False else r[iw.columns.get_loc(c)]
        ordv = float(g("Ordered Value") or 0); delb = float(g("Basic Delivered Value") or 0)
        L.append([ix("WBS", w), ix("WDESC", s(g("WBS Description"))), ix("VEND", s(g("Vendor Name"))),
                  ix("PGRP", s(g("P.Grp Name"))), ix("PLANT", s(g("Plant Name"))), ix("GL", s(g("GL Code Description"))),
                  ix("DTYP", s(g("Document Type"))), ix("COMP", s(g("Company Description"))),
                  ix("ROOT", root_of.get(w, "—")), day(g("Document Date")), s(g("Purchasing Document"), "nan"),
                  round(ordv, 2), round(float(g("Ordered with GST") or 0), 2), round(delb, 2),
                  round(float(g("Delivered Value with GST") or 0), 2), round(ordv - delb, 2),
                  1 if w in root_of else 0])

    B = []
    for r in smw.itertuples(index=False):
        c = lambda n: float(r[sm.columns.get_loc(n)] or 0)
        w = r[sm.columns.get_loc("WBS")]
        B.append([ix("WBS", w), round(c("Budget"), 2), round(c("Basic Budget"), 2), round(c("Assigned"), 2),
                  round(c("Basic Assigned"), 2), round(c("Total Actual"), 2), round(c("Basic Total Actual"), 2),
                  round(c("Actual PO Sum"), 2), round(c("Actual Non-PO"), 2), round(c("Commitment"), 2),
                  round(c("Basic Commitment"), 2), round(c("Budget Available"), 2), round(c("Basic Available Budget"), 2),
                  ix("ROOT", s(r[sm.columns.get_loc("Project Description")])),
                  ix("PGRP", s(r[sm.columns.get_loc("P.Grp Name")]))])

    # tie-out: Summary actual per WBS vs GL postings file
    a = smw.groupby("WBS")["Total Actual"].sum(); b = ta.groupby("WBS")["Total Actual Amount"].sum()
    j = pd.concat([a, b], axis=1).fillna(0); j.columns = ["sm", "ta"]
    off = int(((j.sm - j.ta).abs() > 1).sum())
    ia = set(iw["WBS"].dropna()); unm = len(ia - set(smw["WBS"]))

    meta = {"asOn": as_on, "source": "Non-Project FY26-27: Item Wise + Summary + Total Actual",
            "lines": len(L), "wbs": len({l[0] for l in L}), "pos": int(iw["Purchasing Document"].nunique()),
            "budgetWbs": len(B), "postings": int(len(ta)),
            "tieout": {"actualWbsChecked": int(len(j)), "actualMismatch": off, "poWbsNotInSummary": unm,
                       "actualTotal": round(float(a.sum()), 2), "postingsTotal": round(float(b.sum()), 2)},
            "fields": "L=[wbs,wdesc,vend,pgrp,plant,gl,dtyp,comp,root,day,po,ord,ordGst,del,delGst,still,mapped] "
                      "B=[wbs,budget,basicBudget,assigned,basicAssigned,actual,basicActual,actualPO,actualNonPO,commitment,basicCommitment,available,basicAvailable,root,pgrp]"}
    out = {k: list(v) for k, v in lex.items()}
    out["L"] = L; out["B"] = B; out["meta"] = meta
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:5])
