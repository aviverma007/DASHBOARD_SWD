#!/usr/bin/env python3
"""Due / Undue page data (src/data/dappData.json) live from SAP ZSD_DAPP (ZSDR_DUE_PAYMENT,
"Due / Undue as per Payment Plan Milestone").

  VendorGlobe API (app/pdrn_sync.py, feed "zdapp") calls /sap/zdapp for every company twice - SAP's
  own "Due" and "Undue" radio buttons - into SQL PDRN.dbo.SAP_ZDAPP (CALL_KEY "1010 due") at
  13:00/17:00 -> this script reads /zdapp/rows -> one row per payment-plan milestone.

Amounts (SAP fields of the report's ALV):
  amount       KBETR2 Total Due Amount With Tax (else KZWI3 Total Demand With Tax, else FAKWR)
  received     ZREC_AMT1 Received Amount (0 where the Undue layout has none)
  outstanding  ZOUT_AMT Outstanding Amount when SAP gives it, else amount - received (not below 0)

R = [kind(0 due,1 undue), proj, cust, unit, so, milestone, dueDay, billDay, amount, received,
     outstanding, plan, tower]   days since 2022-01-01 (-1 none)
Exit codes: 0 rebuilt · 3 nothing new · 1 failed (nothing written).
Usage: python scripts/dapp_from_sap.py [--force] [--check]
"""
import datetime
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sap_live as sl  # noqa: E402

OUT = os.path.join(sl.DATA, "dappData.json")
EPOCH = datetime.datetime(2022, 1, 1)
NEEDED = {"ZCOMP_CODE", "PLANT", "MAKTX1", "VBELN", "NAME1", "TEBEZ", "DUE"}


def day(v):
    d = sl.to_date(v)
    return (d - EPOCH).days if d else -1


def num(r, *fields):
    """First of the fields that SAP returned for this row (a layout may not have them all)."""
    for f in fields:
        if f in r and r[f] not in (None, ""):
            return sl.to_num(r[f])
    return None


def main(argv):
    force, check = "--force" in argv, "--check" in argv
    ans = sl.fetch_rows("zdapp")
    rows = ans["rows"]
    if not rows:
        print("  SQL table PDRN.dbo.SAP_ZDAPP is empty - the API has not loaded ZSD_DAPP yet (see /zdapp/health).")
        return 3
    load_id = ans.get("loadId")
    if load_id is not None and load_id == sl.json_meta("dappData.json").get("loadId") and not force and not check:
        print(f"  ZSD_DAPP SQL load #{load_id} is already on the dashboard - nothing new")
        return 3
    as_on, iso = sl.load_time(ans)
    gone = sorted(NEEDED - set().union(*(r.keys() for r in rows)))
    if gone:
        raise RuntimeError(f"ZSD_DAPP no longer returns field(s) {gone} - report changed? Not loading.")
    calls = Counter(sl.to_text(r.get("CALL_KEY")) for r in rows)
    print(f"  ZSD_DAPP SQL snapshot #{load_id}: {len(rows)} milestones, loaded from SAP {as_on} · "
          + ", ".join(f"{k}: {v}" for k, v in sorted(calls.items())))

    lists = {k: [] for k in ("P", "M", "PL", "T")}
    cix, C = {}, []

    def ix(k, v):
        v = sl.to_text(v) or "—"
        lst = lists[k]
        if v not in lst:
            lst.append(v)
        return lst.index(v)

    R, skipped = [], 0
    for r in rows:
        key = sl.to_text(r.get("CALL_KEY")) or ""
        kind = 1 if key.endswith("undue") else 0 if key.endswith("due") else None
        if kind is None:
            skipped += 1
            continue
        amount = num(r, "KBETR2", "KZWI3", "FAKWR") or 0.0
        received = num(r, "ZREC_AMT1") or 0.0
        out = num(r, "ZOUT_AMT")
        outstanding = out if out is not None else max(amount - received, 0.0)
        code = sl.to_id(r.get("CUST_CODE")) or sl.to_id(r.get("SOLD_PARTY")) or "—"
        if code not in cix:
            cix[code] = len(C)
            C.append([code, sl.to_text(r.get("NAME1")) or sl.to_text(r.get("SOLD_PARTY_NAME")) or ""])
        R.append([kind, ix("P", r.get("PLANT")), cix[code], sl.to_text(r.get("MAKTX1")) or sl.to_text(r.get("ARKTX")) or "",
                  sl.to_id(r.get("VBELN")) or "", ix("M", r.get("TEBEZ")), day(r.get("DUE")), day(r.get("FKDAT")),
                  round(amount, 2), round(received, 2), round(outstanding, 2), ix("PL", r.get("ZPPLAN")),
                  ix("T", r.get("BEZEI"))])
    if skipped:
        print(f"  {skipped} rows without a due/undue call key skipped")
    t = datetime.datetime.fromisoformat(iso)
    as_on_day = (datetime.datetime(t.year, t.month, t.day) - EPOCH).days
    due = [x for x in R if x[0] == 0]
    undue = [x for x in R if x[0] == 1]
    print(f"  due: {len(due)} milestones, amount ₹{sum(x[8] for x in due) / 1e7:.2f} Cr, "
          f"outstanding ₹{sum(x[10] for x in due) / 1e7:.2f} Cr · undue: {len(undue)} milestones, "
          f"₹{sum(x[8] for x in undue) / 1e7:.2f} Cr")
    if check:
        print("check OK - nothing written (--check)")
        return 0
    old = sl.json_meta("dappData.json")
    if old.get("rows") and len(R) < old["rows"] * float(sl.env("VG_ZDAPP_MIN_RATIO", "0.5")):
        raise RuntimeError(f"milestones fell from {old['rows']} to {len(R)} - looks incomplete, not loading")
    out = {"meta": {"asOn": as_on, "asOnDay": as_on_day, "epoch": "2022-01-01", "rows": len(R),
                    "loadId": load_id, "loadedAt": iso, "live": True,
                    "source": f"SAP live (ZSD_DAPP via SQL PDRN.dbo.SAP_ZDAPP, load #{load_id}, {as_on})",
                    "fields": "R=[kind(0 due,1 undue),proj,cust,unit,so,milestone,dueDay,billDay,amount,received,outstanding,plan,tower] C=[code,name]"},
           **lists, "C": C, "R": R}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"), ensure_ascii=False)
    sl.set_data_info("DAPP", as_on, iso)
    print(f"Due / Undue refreshed live from SAP - {len(R)} milestones, data as on {as_on}")
    return 0


if __name__ == "__main__":
    sl.run(main)
