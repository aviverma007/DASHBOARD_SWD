#!/usr/bin/env python3
"""Make inventory booking status agree with the PDRN, so every page counts the same sold units.

Run after convert_invr_export.py and build_pdrn.py (build_tva.py calls it first, so the normal
refresh order needs no extra step):
    python3 scripts/sync_inventory_with_pdrn.py

The INVR (stock register) and the PDRN (bookings) are separate SAP exports and disagree on a few
units even on the same day. For BOOKING STATUS the PDRN is the authority:
  - INVR "Booked" but the PDRN has only a CANCELLED row for the unit  -> Available
  - INVR Available / Management but the PDRN has an ACTIVE booking   -> Booked
  - an ACTIVE PDRN unit missing from the INVR export altogether       -> added as a Booked unit
    (tower / type copied from a sibling unit of the same tower), so Total = Sold + Available
Every change is printed, so data issues can be reported back to SAP.
"""
import json, os, re

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data")
INV, CP = os.path.join(D, "smartworldInventory.json"), os.path.join(D, "cpAnalytics.json")


def main():
    inv, cp = json.load(open(INV, encoding="utf-8")), json.load(open(CP, encoding="utf-8"))
    up = lambda s: str(s).strip().upper()
    act, can, act_row = set(), set(), {}
    for r in cp["R"]:
        k = (up(cp["P"][r[0]]), str(r[9]).strip())
        (act if r[13] == 0 else can).add(k)
        if r[13] == 0:
            act_row[k] = r
    have = {}
    changes = []
    for u in inv["U"]:
        k = (up(inv["P"][u[0]]), str(u[12]).strip())
        have[k] = u
        if u[8] == 1 and k not in act and k in can:
            u[8], u[9] = 0, 0
            changes.append(f"  {k[0]} {k[1]}: INVR Booked, PDRN cancelled -> Available")
        elif u[8] != 1 and k in act:
            u[8], u[9] = 1, 0
            changes.append(f"  {k[0]} {k[1]}: INVR not booked, PDRN active -> Booked")
    for k in sorted(act - set(have)):
        if k[0] not in [up(p) for p in inv["P"]]:
            continue
        pi = [up(p) for p in inv["P"]].index(k[0])
        pref = re.match(r"^([A-Z]+(?:-[A-Z]+)?-?)", k[1])
        sib = next((u for u in inv["U"] if u[0] == pi and pref and str(u[12]).startswith(pref.group(1))),
                   next((u for u in inv["U"] if u[0] == pi), None))
        if sib is None:
            continue
        r = act_row[k]
        fl_name = cp["FL"][r[3]] if 0 <= r[3] < len(cp["FL"]) else None
        fl_idx = inv["FL"].index(fl_name) if fl_name in inv["FL"] else sib[3]
        inv["U"].append([pi, sib[1], float(r[2]), fl_idx, sib[4], sib[5], int(r[5] or sib[6]),
                         float(r[6] or 0), 1, 0, -1, 0, k[1]])
        changes.append(f"  {k[0]} {k[1]}: PDRN active, missing from INVR -> added as Booked")
    inv.setdefault("HY", {})["pdrnSync"] = changes
    json.dump(inv, open(INV, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print(f"inventory synced with PDRN: {len(changes)} unit(s) corrected")
    for c in changes:
        print(c)


if __name__ == "__main__":
    main()
