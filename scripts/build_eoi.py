#!/usr/bin/env python3
"""Build src/data/eoiData.json from one or more EOI receipt exports.

Usage:  python3 scripts/build_eoi.py <file1.xlsx> [file2.xlsx ...]
        (accepts the per-project EOI exports or the per-company ZREC prints,
         named by profit center / company: 1072, 2010, 201301, 2070, 3070 …)

Rules added with the 30-Oct-2026 ZREC prints:
- A customer belongs to ONE project. Full 6-digit profit centers decide it;
  rows with a truncated ('2010') or blank center inherit the customer's
  project, else the company default (2010 = The Edition, 2070 = Nature's
  Court). So Code 67 (201301) receipts posted on '2010' stay Code 67.
- Customer codes are keyed per company, taken from the file name (a few codes
  repeat across companies; 201301 belongs to company 2010).
- Receipt Status RECEIVED (entered, not yet cleared) is kept as its own
  status and left out of the cleared totals.

Rules learned from the 25-Sep-2026 exports:
- Project is decided by Profit Center (files overlap: the Suites Noida
  export also carries Le Courtyard rows and vice-versa), with the
  file's own project as fallback for truncated/blank centers.
- Rows are deduped across files on (cust, doc no, date, amount, status).
- Receipt Status: CLEARED money in, ADJUSTMENT JV move, PAYMENT refund,
  BOUNCE failed (excluded from totals downstream).
"""
import sys, os, json, datetime, re
import openpyxl
from collections import defaultdict

EPOCH = datetime.datetime(2022, 1, 1)
RS = ["CLEARED", "ADJUSTMENT", "BOUNCE", "PAYMENT", "RECEIVED"]
STAT = {"ALLOTMENT PENDING": 0, "ACTIVE": 1, "CANCEL": 2}

# Profit Center -> canonical project name (prefix match covers the
# truncated centers some rows carry, e.g. '1070', '2010').
# Full 6-digit centers name the project outright.
PC_PROJECT = [
    ("107202", "TRUMP RESIDENCES GURGAON"),
    ("201301", "CODE 67 GURGAON"),
    ("207101", "SMARTWORLD NATURE'S COURT"), ("207301", "SMARTWORLD NATURE'S COURT"),
    ("307301", "SMARTWORLD SUITES NOIDA"),
    ("307201", "LE COURTYARD NOIDA"),
    ("307101", "SMARTWORLD RESIDENTIAL NOIDA"),
]
# Company (first 4 digits of the center, or the file name) -> default project
# for rows whose center is truncated/blank and whose customer has no full center.
COMPANY_DEFAULT = {"1070": "TRUMP RESIDENCES GURGAON", "2010": "SMARTWORLD THE EDITION",
                   "2070": "SMARTWORLD NATURE'S COURT"}
# file-name hint -> fallback project when Profit Center is blank
FILE_COMPANY = [("201301", "2010"), ("2010", "2010"), ("1072", "1070"), ("1070", "1070"),
                ("2070", "2070"), ("3070", "3070")]
FILE_PROJECT = [
    ("trump", "TRUMP RESIDENCES GURGAON"),
    ("code_67", "CODE 67 GURGAON"), ("code67", "CODE 67 GURGAON"),
    ("suits", "SMARTWORLD SUITES NOIDA"), ("suites", "SMARTWORLD SUITES NOIDA"),
    ("courtyard", "LE COURTYARD NOIDA"),
    ("residential", "SMARTWORLD RESIDENTIAL NOIDA"),
]

def day(v):
    return (v - EPOCH).days if isinstance(v, datetime.datetime) else -1

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0

def main(paths):
    projects, modes, pts = [], [], []
    def ix(lst, v):
        v = str(v or "").strip() or "—"
        if v not in lst:
            lst.append(v)
        return lst.index(v)

    seen_rows = set()
    by = defaultdict(list)          # (projIdx, code) -> receipts
    meta_c = {}
    dupes = 0
    unplaced = defaultdict(int)
    unknown_rs = defaultdict(int)
    # pass 1: read every row; note each customer's full profit centers
    rows = []
    full_pc = defaultdict(lambda: defaultdict(int))     # (company, code) -> project -> n rows
    for path in paths:
        fname = os.path.basename(path).lower()
        stem = re.sub(r"^[0-9a-f]{8}-", "", fname)          # upload prefix
        file_proj = next((p for h, p in FILE_PROJECT if h in fname), None)
        file_co = next((c for h, c in FILE_COMPANY if stem.startswith(h)), None)
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.worksheets[0]
        it = ws.iter_rows(values_only=True)
        hdr = next(it)
        idx = {h: i for i, h in enumerate(hdr)}
        for r in it:
            code = str(r[idx["Cust. Code"]] or "").strip()
            if not code:
                continue
            pc = str(r[idx["Profit Center"]] or "").strip()
            # company: from the file name (centers don't carry it: 201301 is company 2010)
            co = file_co or (pc[:3] + "0" if len(pc) >= 3 else None)
            proj = next((p for pref, p in PC_PROJECT if len(pc) >= 6 and pc.startswith(pref)), None)
            if proj:
                full_pc[(co, code)][proj] += 1
            rows.append((co, code, proj, file_proj, r, idx))

    # pass 2: one project per customer, then the receipts
    for co, code, proj, file_proj, r, idx in rows:
        owned = full_pc.get((co, code))
        if owned:
            cust_proj = max(owned.items(), key=lambda kv: kv[1])[0]
            proj = cust_proj if proj is None or co == "2010" else proj
        proj = proj or COMPANY_DEFAULT.get(co or "") or file_proj
        if proj is None:
            unplaced[co or "?"] += 1
            continue
        key_code = f"{co}|{code}" if co else code
        pi = ix(projects, proj)
        d = day(r[idx["Receipt Date"]])
        amt = round(num(r[idx["Net Amount"]]), 2)
        rs = str(r[idx["Receipt Status"]] or "").strip()
        if rs not in RS:
            unknown_rs[rs] += 1
        rsi = RS.index(rs) if rs in RS else 0
        doc = str(r[idx["Document Number"]] or "")
        key = (co, code, doc, d, amt, rsi)
        if key in seen_rows:
            dupes += 1
            continue
        seen_rows.add(key)
        by[(pi, key_code)].append([d, amt, rsi, ix(modes, r[idx["Mode of Payment"]]), ix(pts, r[idx["Payment Type"]]), doc])
        m = meta_c.setdefault((pi, key_code), {"st": 0, "name": "", "unit": "", "allot": -1, "code": code})
        m["st"] = STAT.get(str(r[idx["Customer Status"]] or "").strip(), 0)
        if r[idx["Latest Customer Name"]]:
            m["name"] = str(r[idx["Latest Customer Name"]]).strip()
        if r[idx["Unit Address"]]:
            m["unit"] = str(r[idx["Unit Address"]]).strip()
        ad = day(r[idx["Allotment Date"]])
        if ad >= 0:
            m["allot"] = ad

    C, R = [], []
    for (pi, code) in sorted(by, key=lambda k: (k[0], k[1])):
        recs = sorted(by[(pi, code)], key=lambda x: x[0])
        m = meta_c[(pi, code)]
        days = [x[0] for x in recs if x[0] >= 0]
        first, last = (min(days), max(days)) if days else (-1, -1)
        sums = [0.0] * len(RS)
        for x in recs:
            sums[x[2]] += x[1]
        ci = len(C)
        C.append([m["code"], pi, m["st"], m["name"], m["unit"], m["allot"], first, last,
                  round(sums[0], 2), round(sums[1], 2), round(sums[3], 2), round(sums[2], 2), len(recs)])
        for x in recs:
            R.append([ci] + x)

    last = max((x[1] for x in R if x[1] >= 0), default=-1)
    as_on = (EPOCH + datetime.timedelta(days=last)).strftime("%d %b %Y") if last >= 0 else ""
    out = {
        "meta": {"asOn": as_on, "epoch": "2022-01-01",
                 "source": f"EOI / receipt exports up to {as_on} ({len(paths)} files, {dupes} duplicate rows dropped)",
                 "fields": {"C": "code,projIdx,status(0 pending/1 allotted/2 cancelled),name,unit,allotDay,firstRcptDay,lastRcptDay,cleared,adjustments,refunds,bounced,nReceipts",
                            "R": "custIdx,day,netAmt,rsIdx(CLEARED/ADJUSTMENT/BOUNCE/PAYMENT/RECEIVED),modeIdx,ptIdx,docNo"}},
        "PROJECTS": projects, "RS": RS, "MODE": modes, "PT": pts, "C": C, "R": R,
    }
    dest = os.path.join(os.path.dirname(__file__), "..", "src", "data", "eoiData.json")
    with open(dest, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))

    print(f"{len(C)} customers, {len(R)} receipts, {dupes} cross-file duplicates dropped, {os.path.getsize(dest)//1024} KB, as on {as_on}")
    if unplaced: print("  NOT PLACED (no project):", dict(unplaced))
    if unknown_rs: print("  unknown receipt status counted as CLEARED:", dict(unknown_rs))
    for pi, p in enumerate(projects):
        cs = [c for c in C if c[1] == pi]
        pend = [c for c in cs if c[2] == 0]
        hold = [c for c in pend if (c[8] + c[9] + c[10]) > 1000 and not (c[12] >= 100 and c[8] > 0 and abs(c[9]) >= 0.9 * c[8])]
        print(f"  {p}: {len(cs)} customers | pending {len(pend)} (cleared ₹{sum(c[8] for c in pend)/1e7:.2f} Cr) | in-hand {len(hold)} (₹{sum(c[8]+c[9]+c[10] for c in hold)/1e7:.2f} Cr)")

if __name__ == "__main__":
    main(sys.argv[1:])
