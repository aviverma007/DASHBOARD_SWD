#!/usr/bin/env python3
"""Build src/data/eoiData.json from one or more EOI receipt exports.

Usage:  python3 scripts/build_eoi.py <file1.xlsx> [file2.xlsx ...]

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
RS = ["CLEARED", "ADJUSTMENT", "BOUNCE", "PAYMENT"]
STAT = {"ALLOTMENT PENDING": 0, "ACTIVE": 1, "CANCEL": 2}

# Profit Center -> canonical project name (prefix match covers the
# truncated centers some rows carry, e.g. '1070', '2010').
PC_PROJECT = [
    ("107202", "TRUMP RESIDENCES GURGAON"), ("1070", "TRUMP RESIDENCES GURGAON"),
    ("201301", "CODE 67 GURGAON"), ("2010", "CODE 67 GURGAON"),
    ("307301", "SMARTWORLD SUITES NOIDA"),
    ("307201", "LE COURTYARD NOIDA"),
    ("307101", "SMARTWORLD RESIDENTIAL NOIDA"),
]
# file-name hint -> fallback project when Profit Center is blank
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
    for path in paths:
        fname = os.path.basename(path).lower()
        file_proj = next((p for h, p in FILE_PROJECT if h in fname), None)
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
            proj = next((p for pref, p in PC_PROJECT if pc.startswith(pref) and pc), None) or file_proj
            if proj is None:
                continue
            pi = ix(projects, proj)
            d = day(r[idx["Receipt Date"]])
            amt = round(num(r[idx["Net Amount"]]), 2)
            rs = str(r[idx["Receipt Status"]] or "").strip()
            rsi = RS.index(rs) if rs in RS else 0
            doc = str(r[idx["Document Number"]] or "")
            key = (code, doc, d, amt, rsi)
            if key in seen_rows:
                dupes += 1
                continue
            seen_rows.add(key)
            by[(pi, code)].append([d, amt, rsi, ix(modes, r[idx["Mode of Payment"]]), ix(pts, r[idx["Payment Type"]]), doc])
            m = meta_c.setdefault((pi, code), {"st": 0, "name": "", "unit": "", "allot": -1})
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
        sums = [0.0] * 4
        for x in recs:
            sums[x[2]] += x[1]
        ci = len(C)
        C.append([code, pi, m["st"], m["name"], m["unit"], m["allot"], first, last,
                  round(sums[0], 2), round(sums[1], 2), round(sums[3], 2), round(sums[2], 2), len(recs)])
        for x in recs:
            R.append([ci] + x)

    out = {
        "meta": {"asOn": "25 Sep 2026", "epoch": "2022-01-01",
                 "source": f"EOI receipt exports 25-09-2026 ({len(paths)} files, {dupes} duplicate rows dropped)",
                 "fields": {"C": "code,projIdx,status(0 pending/1 allotted/2 cancelled),name,unit,allotDay,firstRcptDay,lastRcptDay,cleared,adjustments,refunds,bounced,nReceipts",
                            "R": "custIdx,day,netAmt,rsIdx(CLEARED/ADJUSTMENT/BOUNCE/PAYMENT),modeIdx,ptIdx,docNo"}},
        "PROJECTS": projects, "RS": RS, "MODE": modes, "PT": pts, "C": C, "R": R,
    }
    dest = os.path.join(os.path.dirname(__file__), "..", "src", "data", "eoiData.json")
    with open(dest, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))

    print(f"{len(C)} customers, {len(R)} receipts, {dupes} cross-file duplicates dropped, {os.path.getsize(dest)//1024} KB")
    for pi, p in enumerate(projects):
        cs = [c for c in C if c[1] == pi]
        pend = [c for c in cs if c[2] == 0]
        hold = [c for c in pend if (c[8] + c[9] + c[10]) > 1000 and not (c[12] >= 100 and c[8] > 0 and abs(c[9]) >= 0.9 * c[8])]
        print(f"  {p}: {len(cs)} customers | pending {len(pend)} (cleared ₹{sum(c[8] for c in pend)/1e7:.2f} Cr) | in-hand {len(hold)} (₹{sum(c[8]+c[9]+c[10] for c in hold)/1e7:.2f} Cr)")

if __name__ == "__main__":
    main(sys.argv[1:])
