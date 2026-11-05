#!/usr/bin/env python3
"""Build src/data/collections.json — dated customer receipts — from SAP ZREC receipt prints
(one per company / profit center: 2010, 201301, 1072, 2070, 3070 …).

Usage: python3 scripts/build_collections.py <zrec1.xlsx> [zrec2.xlsx …]

What counts (shown on the SAP Collection → Collections view):
  cash        Payment Type RECEIPT, status CLEARED, mode ONLINE / CHEQUE / DEMAND DRAFT …
  tds         Payment Type RECEIPT, status CLEARED, mode TDS CHALLAN (buyer's TDS, a credit, not bank money)
  bounce      status BOUNCE (excluded from collection)
  pending     status RECEIVED (entered, not yet cleared)
  refund      Payment Type PAYMENT (money paid back)
  jv          Payment Type JOURNAL VOUCHER (moves money between customer codes — e.g. the EOI
              collection pool to the customer — never new money, so never added to collection)
Project: one per customer — full profit centers decide it, truncated/blank centers inherit
the customer's project, else the company default (same rules as build_eoi.py).
Rows repeated across files (201301 is a subset of the 2010 print) are kept once.

Link to the PDRN (src/data/cpAnalytics.json, the Booking-wise tab's data):
  per active booked unit, ZREC net (cash + TDS + JV − refunds) is compared with the PDRN's
  Net Received Including Tax. Where ZREC is higher by exactly a set of launch cheques
  (instrument "EDN-xxxx N/A …", Nov 2023) the PDRN never counted, those receipts become
  kind 6 "Not counted in PDRN" — kept and listed, never added to collection.
  Export ZREC and PDRN on the same day so timing does not create gaps.

R = [day, clearDay, amount, proj, kind, mode, bank, channel, charge, custStatus, cust, doc]
  kind: 0 cash · 1 tds · 2 bounce · 3 pending · 4 refund · 5 jv · 6 not counted in PDRN
C = [code, name, unit, company]
"""
import sys, os, re, json, datetime, itertools
from collections import defaultdict
import openpyxl

EPOCH = datetime.datetime(2022, 1, 1)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "collections.json")
KINDS = ["Cash", "TDS", "Bounced", "Pending clearance", "Refund", "Journal voucher", "Not counted in PDRN"]
PDRN_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "cpAnalytics.json")
# collection project -> PDRN project name
PDRN_PROJECT = {"The Edition": "SMARTWORLD THE EDITION", "Trump Residences": "Trump Residences Gurgaon",
                "Nature's Court": "Smartworld Nature\u2019s Court l", "Le Courtyard": "Smartworld Le Courtyard",
                "Suites": "Smartworld Suites", "Sky Arc": "Smartworld Sky Arc"}
unit_key = lambda u: re.sub(r"\s+", "", str(u or "")).upper()


def flag_not_in_pdrn(R, C, projects, launch):
    """Mark launch cheques the PDRN does not count (see module doc). Returns {project: [n, amount]}."""
    if not os.path.exists(PDRN_JSON):
        return {}
    pd = json.load(open(PDRN_JSON, encoding="utf-8"))
    pdrn = {}
    for r in pd["R"]:
        if r[13] == 0:
            pdrn[(pd["P"][r[0]], unit_key(r[9]))] = pdrn.get((pd["P"][r[0]], unit_key(r[9])), 0) + r[24]
    by_unit = defaultdict(list)
    for i, x in enumerate(R):
        u = unit_key(C[x[10]][2])
        if u:
            by_unit[(projects[x[3]], u)].append(i)
    out = defaultdict(lambda: [0, 0.0])
    for (proj, u), idxs in by_unit.items():
        key = (PDRN_PROJECT.get(proj), u)
        if key not in pdrn:
            continue
        gap = sum(R[i][2] for i in idxs if R[i][4] in (0, 1, 4, 5)) - pdrn[key]
        cand = [i for i in idxs if i in launch and R[i][4] == 0]
        if gap <= 1000 or not cand:
            continue
        hit = None
        for n in range(1, min(4, len(cand)) + 1):
            hit = next((c for c in itertools.combinations(cand, n) if abs(sum(R[i][2] for i in c) - gap) < 2), None)
            if hit:
                break
        for i in hit or ():
            R[i][4] = 6
            out[proj][0] += 1
            out[proj][1] += R[i][2]
    return {p: [n, round(a, 2)] for p, (n, a) in out.items()}
PC_PROJECT = [("107202", "Trump Residences"), ("107101", "Sky Arc"), ("201301", "Code 67"),
              ("207101", "Nature's Court"), ("207301", "Nature's Court"),
              ("307301", "Suites"), ("307201", "Le Courtyard"), ("307101", "Residential Noida")]
COMPANY_DEFAULT = {"1070": "Trump Residences", "2010": "The Edition", "2070": "Nature's Court"}
FILE_COMPANY = [("201301", "2010"), ("2010", "2010"), ("1072", "1070"), ("1071", "1070"), ("1070", "1070"),
                ("2070", "2070"), ("3070", "3070"), ("1013", "1013")]
GATEWAYS = re.compile(r"easebuzz|paytm|m-swipe|mswipe|cc ?avenue|razorpay|payu|billdesk", re.I)


def day(v):
    return (v - EPOCH).days if isinstance(v, datetime.datetime) else -1


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def bank_name(s):
    s = re.sub(r"[.,]", " ", str(s or "").upper())
    s = re.sub(r"\b(LIMITED|LTD|BANK LTD|CO-OP|THE)\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if not s or s in ("OTHERS", "NONE"):
        return "Other / not stated"
    if s == "TDS":
        return "TDS"
    if s.startswith("UPI"):
        return "UPI"
    if re.match(r"(BEING|INFT|NEFT|RTGS|IMPS|BY |TO |CHQ|CH NO|REF)", s) or re.search(r"\d{4,}", s) or len(s) < 3:
        return "Other / not stated"
    s = {"KMB": "KOTAK", "KOTAK MAHINDRA": "KOTAK", "PNB": "PUNJAB NATIONAL", "BOB": "BANK OF BARODA",
         "IOB": "INDIAN OVERSEAS", "UBI": "UNION BANK", "BOI": "BANK OF INDIA"}.get(s, s)
    m = re.match(r"(HDFC|ICICI|AXIS|KOTAK|YES|IDFC|INDUSIND|STATE BANK OF INDIA|SBI|PUNJAB NATIONAL|BANK OF BARODA|CANARA|UNION BANK|BANK OF INDIA|IDBI|FEDERAL|RBL|AU SMALL|STANDARD CHARTERED|CITI|HSBC|DBS|BANDHAN|INDIAN OVERSEAS|INDIAN BANK|CENTRAL BANK)", s)
    if m:
        k = m.group(1)
        return {"SBI": "STATE BANK OF INDIA", "PUNJAB NATIONAL": "PUNJAB NATIONAL BANK"}.get(k, k if "BANK" in k else k + " BANK").title().replace("Of", "of")
    return s.title()[:40]


def main(paths):
    lists = {k: [] for k in ("PROJECTS", "MODES", "BANKS", "CHANNELS", "CHARGES", "CSTATUS")}
    def ix(k, v):
        v = str(v or "").strip() or "—"
        lst = lists[k]
        if v not in lst:
            lst.append(v)
        return lst.index(v)

    rows, owned = [], defaultdict(lambda: defaultdict(int))
    for path in paths:
        stem = re.sub(r"^[0-9a-f]{8}-", "", os.path.basename(path).lower())
        co_file = next((c for h, c in FILE_COMPANY if stem.startswith(h)), None)
        ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
        it = ws.iter_rows(values_only=True)
        idx = {h: i for i, h in enumerate(next(it))}
        for r in it:
            code = str(r[idx["Cust. Code"]] or "").strip()
            if not code:
                continue
            pc = str(r[idx["Profit Center"]] or "").strip()
            co = co_file or (pc[:3] + "0" if len(pc) >= 3 else "?")
            proj = next((p for pref, p in PC_PROJECT if len(pc) >= 6 and pc.startswith(pref)), None)
            if proj:
                owned[(co, code)][proj] += 1
            rows.append((co, code, proj, r, idx))

    seen, R, C, cidx, unplaced, dupes, launch = set(), [], [], {}, defaultdict(int), 0, set()
    for co, code, proj, r, idx in rows:
        o = owned.get((co, code))
        if o:
            best = max(o.items(), key=lambda kv: kv[1])[0]
            proj = best if proj is None or co == "2010" else proj
        proj = proj or COMPANY_DEFAULT.get(co)
        if not proj:
            unplaced[co] += 1
            continue
        g = lambda c: r[idx[c]] if c in idx else None
        d, amt = day(g("Receipt Date")), round(num(g("Net Amount")), 2)
        st, pt, mode = str(g("Receipt Status") or "").strip(), str(g("Payment Type") or "").strip(), str(g("Mode of Payment") or "").strip()
        doc = str(g("Document Number") or "")
        key = (co, code, doc, d, amt, st)
        if key in seen:
            dupes += 1
            continue
        seen.add(key)
        kind = (5 if pt == "JOURNAL VOUCHER" else 4 if pt == "PAYMENT" or st == "PAYMENT" else
                2 if st == "BOUNCE" else 3 if st == "RECEIVED" else 1 if "TDS" in mode.upper() else 0)
        clr = str(g("Clearing Bank Name") or "")
        channel = "Payment gateway" if GATEWAYS.search(clr) else "TDS" if kind == 1 else "Bank account" if clr.strip() else "—"
        ck = (co, code)
        if ck not in cidx:
            cidx[ck] = len(C)
            C.append([code, "", "", co])
        c = C[cidx[ck]]
        if g("Latest Customer Name"):
            c[1] = str(g("Latest Customer Name")).strip()
        if g("Unit Address"):
            c[2] = str(g("Unit Address")).strip()
        if " N/A" in str(g("Instrument No.") or ""):
            launch.add(len(R))
        R.append([d, day(g("Clearing/Bounce Date")), amt, ix("PROJECTS", proj), kind, ix("MODES", mode),
                  ix("BANKS", "TDS" if kind == 1 else bank_name(g("Bank Name"))), ix("CHANNELS", channel),
                  ix("CHARGES", g("Charge Type") or "Unspecified"), ix("CSTATUS", g("Customer Status")), cidx[ck], doc])

    not_in_pdrn = flag_not_in_pdrn(R, C, lists["PROJECTS"], launch)
    R.sort(key=lambda x: (x[0], x[2]))
    last = max((x[0] for x in R if x[0] >= 0 and x[4] in (0, 1)), default=-1)
    as_on = (EPOCH + datetime.timedelta(days=last)).strftime("%d %b %Y") if last >= 0 else ""
    first = {}
    for x in R:
        if x[0] >= 0 and x[4] in (0, 1):
            p = lists["PROJECTS"][x[3]]
            first[p] = min(first.get(p, x[0]), x[0])
    out = {"meta": {"asOn": as_on, "asOnDay": last, "epoch": "2022-01-01", "files": len(paths), "duplicatesDropped": dupes,
                    "coverageFrom": {p: (EPOCH + datetime.timedelta(days=d)).strftime("%Y-%m-%d") for p, d in first.items()},
                    "source": "SAP ZREC receipt prints", "notInPdrn": not_in_pdrn,
                    "fields": "R=[day,clearDay,amount,proj,kind(0 cash,1 tds,2 bounced,3 pending,4 refund,5 jv),mode,bank,channel,charge,custStatus,cust,doc] C=[code,name,unit,company]"},
           "KINDS": KINDS, **lists, "C": C, "R": R}
    json.dump(out, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"{len(R)} receipts, {len(C)} customers, {dupes} duplicates dropped, as on {as_on}, {os.path.getsize(OUT) // 1024} KB")
    if unplaced:
        print("  NOT PLACED:", dict(unplaced))
    for pi, p in enumerate(lists["PROJECTS"]):
        cash = sum(x[2] for x in R if x[3] == pi and x[4] == 0)
        tds = sum(x[2] for x in R if x[3] == pi and x[4] == 1)
        if p in not_in_pdrn:
            print(f"  {p:20} not counted in PDRN: {not_in_pdrn[p][0]} launch cheques ₹{not_in_pdrn[p][1] / 1e7:.2f} Cr")
        print(f"  {p:20} cash ₹{cash / 1e7:8.2f} Cr  tds ₹{tds / 1e7:6.2f} Cr  from {out['meta']['coverageFrom'].get(p)}")


if __name__ == "__main__":
    main(sys.argv[1:])
