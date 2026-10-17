#!/usr/bin/env python3
"""Build src/data/costProject.json from the merged Project cost export.

Usage: python3 scripts/build_cost_pj.py <Merged_COST_Project.xlsx> ["<DD Mon YYYY>"]
  The "as on" date defaults to today (IST).

The export is one sheet: the FIRST row of each WBS carries that WBS's budget
figures (Budget, Assigned, Total Actual, Commitment, Budget Available, Actual
PO Sum, Actual Non-PO); every row with a Purchasing Document is a PO line.
PO / non-PO split: Non-PO = Actual Non-PO + Actual Reversal, PO = Total
Actual - Non-PO (the export's "Actual PO Sum" leaves out some PO-linked actuals).
Budget figures are GST-inclusive (commitment tracks "Still to be Delivered
with GST"); the export has no basic/excl-GST budget columns, so both value
slots carry the same numbers and the Project tab shows With-GST values.

Output has the same schema as costNonProject.json so the shared cost view
(src/components/cost/NonProjectView.tsx · createCostModule) renders it:
L = [wbs,wdesc,vend,pgrp,plant,gl,dtyp,comp,root,day,po,ord,ordGst,del,delGst,still,mapped]
B = [wbs,budget,basicBudget,assigned,basicAssigned,actual,basicActual,actualPO,actualNonPO,
     commitment,basicCommitment,available,basicAvailable,root,pgrp,poBasic,bh,plant,wdesc]
A = []  (no actual-postings file for projects)
Dimension mapping for projects:
  ROOT  = project code + company   (CN41 master root)       — "Project" filter
  BH    = level-2 WBS group         (CN41 master, e.g. Trump Tower) — "Segment"
  PGRP  = Expense column, spelling variants merged           — "Expense head"
  PLANT = Plant Name (filled from Plant_WBS when blank)
  COMP  = Profit Center
  DTYP  = PO document type
"""
import sys, os, re, json, datetime
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "data", "costProject.json")
MASTER = os.path.join(HERE, "..", "src", "data", "costMaster.json")
EPOCH = datetime.datetime(2022, 1, 1)
NUM = ["Budget", "Assigned", "Total Actual", "Commitment", "Budget Available", "Actual PO Sum", "Actual Non-PO", "Actual Reversal"]
DTYP = {"ZMAT": "ZMAT · Material", "ZSER": "ZSER · Service", "ZGEN": "ZGEN · General", "ZHIR": "ZHIR · Hire"}


def day(v):
    if pd.isna(v):
        return -1
    return (pd.Timestamp(v).to_pydatetime().replace(tzinfo=None) - EPOCH).days


def s(v, dash="—"):
    return dash if pd.isna(v) or str(v).strip() == "" else re.sub(r"\s+", " ", str(v)).strip()


def f(v):
    return 0.0 if pd.isna(v) else float(v)


def expense_head(v):
    """Merge spelling variants of the free-text Expense column (Civil / Civil Work /
    Civil works …) so each head is one bar; distinct heads stay distinct."""
    t = s(v)
    l = t.lower().replace("façade", "facade")
    if "escalation" in l:
        return "Escalation"
    if l.startswith("short & excess"):
        return "Short & Excess"
    if l.startswith(("license", "residential-license")) or "statutory fees" in l or "stat. fees" in l:
        return "License / Statutory Fees"
    if l.startswith("staff welfare"):
        return "Staff Welfare"
    for key, name in [("civil", "Civil Works"), ("mep", "MEP Works"), ("facade", "Façade Works"), ("finish", "Finishing Works")]:
        if re.fullmatch(key + r"(\w*)?( works?| and structure works)?", l):
            return name
    if l in ("consultancy", "consultancy charges"):
        return "Consultancy"
    return t


def main(src, as_on):
    d = pd.read_excel(src)
    d = d[d["WBS"].notna()].copy()                       # drop any grand-total row
    nodes = json.load(open(MASTER))["N"]
    by = {}
    for i, n in enumerate(nodes):
        c = by.get(n[0])
        if c is None or n[3] > nodes[c][3]:
            by[n[0]] = i

    def resolve(code):
        c = code
        while True:
            if c in by:
                return nodes[by[c]]
            if "-" not in c:
                return None
            c = c[:c.rfind("-")]

    plant_name = d.dropna(subset=["Plant Name"]).groupby("Plant_WBS")["Plant Name"].agg(lambda x: x.mode().iloc[0]).to_dict()

    lex = {k: {} for k in ["WBS", "WDESC", "VEND", "PGRP", "PLANT", "GL", "DTYP", "COMP", "ROOT", "BH"]}

    def ix(k, v):
        m = lex[k]
        if v not in m:
            m[v] = len(m)
        return m[v]

    # ---- per-WBS attributes + budget (first row of each WBS) ----
    first = d.drop_duplicates("WBS", keep="first").set_index("WBS")
    has_po = set(d.loc[d["Purchasing Document"].notna(), "WBS"])
    attrs, unresolved = {}, []
    for w, r in first.iterrows():
        n = resolve(w)
        if n is None:
            unresolved.append(w)
            root, bh = "—", "—"
        else:
            rt, gp = nodes[n[5]], nodes[n[6]]
            root = f"{rt[0]} · {rt[1]}"
            bh = f"{rt[0]} · {gp[1]}" if gp[0] != rt[0] or gp[3] > 1 else root
        pl = r["Plant Name"] if pd.notna(r["Plant Name"]) else plant_name.get(r["Plant_WBS"], f"Plant {r['Plant_WBS']}")
        attrs[w] = dict(root=ix("ROOT", root), bh=ix("BH", bh), pgrp=ix("PGRP", expense_head(r["Expense"])),
                        plant=ix("PLANT", s(pl)), wdesc=ix("WDESC", s(r["WBS Description"])),
                        comp=ix("COMP", s(r["Profit Center"])))

    B, dropped = [], 0
    for w, r in first.iterrows():
        v = [round(f(r[c]), 2) for c in NUM]
        if not any(abs(x) > 0.5 for x in v) and w not in has_po:
            dropped += 1                                     # empty WBS: no budget, no PO
            continue
        bud, asg, act, com, av, _po_col, npo, rev = v
        # Non-PO = Actual Non-PO + Actual Reversal; PO = the rest of Total Actual.
        # The export's "Actual PO Sum" misses PO-linked actuals on 77 WBS (steel
        # supply etc., all with delivered POs), so it is not used as the PO split.
        nonpo = round(npo + rev, 2)
        po = round(act - nonpo, 2)
        a = attrs[w]
        B.append([ix("WBS", w), bud, bud, asg, asg, act, act, po, nonpo, com, com, av, av,
                  a["root"], a["pgrp"], po, a["bh"], a["plant"], a["wdesc"]])

    # ---- PO lines ----
    # A PO item with several account-assigned WBS is repeated IN FULL under each
    # WBS (one civil contract item under up to 25 WBS). Summing those rows would
    # count the item once per WBS, so each copy gets a share of the item:
    # weight = that WBS's utilized (Assigned = actual + commitment), equal split
    # when none of them has any. Item totals are exact; per-WBS PO values for
    # shared items are apportioned estimates.
    pol = d[d["Purchasing Document"].notna()].copy()
    asg_of = {w: max(f(first.at[w, "Assigned"]), 0.0) for w in first.index}
    pol["_w"] = pol["WBS"].map(asg_of)
    key = ["Purchasing Document", "Item No."]
    grp_n = pol.groupby(key)["WBS"].transform("count")
    grp_w = pol.groupby(key)["_w"].transform("sum")
    pol["_share"] = [(w / tw) if tw > 0 else 1.0 / n for w, tw, n in zip(pol["_w"], grp_w, grp_n)]
    shared_items = int((pol.groupby(key)["WBS"].count() > 1).sum())
    L = []
    gl = ix("GL", "—")
    for r in pol.itertuples(index=False):
        g = lambda c: r[pol.columns.get_loc(c)]
        w = g("WBS"); a = attrs[w]; sh = g("_share")
        ordv, delv = f(g("Ordered Value")) * sh, f(g("Delivered Value")) * sh
        L.append([ix("WBS", w), a["wdesc"], ix("VEND", s(g("Vendor Name"))), a["pgrp"], a["plant"], gl,
                  ix("DTYP", DTYP.get(s(g("Document Type")), s(g("Document Type")))), a["comp"], a["root"],
                  day(g("Document Date")), str(int(g("Purchasing Document"))),
                  round(ordv, 2), round(f(g("Ordered with GST")) * sh, 2), round(delv, 2),
                  round(f(g("Delivered Value with GST")) * sh, 2), round(ordv - delv, 2), 1])

    fw = first.reset_index()
    tot = {c: round(float(fw[c].fillna(0).sum()), 2) for c in NUM}
    meta = {
        "asOn": as_on, "source": "Project cost: merged ZALR budget + PO lines (" + os.path.basename(src) + ")",
        "lines": len(L), "wbs": len({l[0] for l in L}), "pos": int(d["Purchasing Document"].nunique()),
        "budgetWbs": len(B), "postings": 0, "gstBasis": "with GST (no basic budget columns in export)",
        "checks": {
            "wbsInFile": int(len(first)), "emptyWbsDropped": dropped, "unresolvedWbs": unresolved[:10],
            "assignedNeActualPlusCommit": int(((fw["Assigned"] - fw["Total Actual"] - fw["Commitment"]).abs() > 1).sum()),
            "availableNeBudgetMinusAssigned": int(((fw["Budget Available"] - fw["Budget"] + fw["Assigned"]).abs() > 1).sum()),
            "actualPoSumGapWbs": int(((fw["Total Actual"] - fw["Actual PO Sum"] - fw["Actual Non-PO"] - fw["Actual Reversal"]).abs() > 1).sum()),
            "sharedPoItems": shared_items,
            "poOrderedWithGstDistinct": round(float(pol.drop_duplicates(key)["Ordered with GST"].sum()), 2),
            "poWbsWithoutBudget": int(sum(1 for w in has_po if not any(abs(f(first.at[w, c])) > 0.5 for c in NUM))),
            "totals": tot,
        },
        "fields": "same as costNonProject.json; basic* = with-GST values (export has no basic budget)",
    }
    out = {k: list(v) for k, v in lex.items()}
    out["L"] = L; out["B"] = B; out["A"] = []; out["meta"] = meta
    json.dump(out, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    print(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    a = sys.argv[1:3]
    if not a:
        sys.exit(__doc__)
    if len(a) == 1:
        a.append((datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)).strftime("%d %b %Y"))
    main(*a)
