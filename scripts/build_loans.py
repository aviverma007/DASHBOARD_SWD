#!/usr/bin/env python3
"""Build src/data/loanData.json from the ZSD Loan report export.
Usage: python3 scripts/build_loans.py <loan_report.xlsx>
"""
import sys, os, json, datetime
import openpyxl

EPOCH = datetime.datetime(2022, 1, 1)

def day(v):
    if isinstance(v, datetime.datetime): return (v - EPOCH).days
    s = str(v or "").strip()
    try: return (datetime.datetime.strptime(s[:10], "%Y-%m-%d") - EPOCH).days
    except ValueError: return -1

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0

PROJ_CANON = {
    "SMARTWORLD SKY ARC": "SMARTWORLD SKY ARC",
    "SMARTWORLD THE EDITION": "SMARTWORLD THE EDITION",
    "TRUMP RESIDENCES GURGAON": "TRUMP RESIDENCES GURGAON",
    "SMARTWORLD ONE DXP PHASE-2": "SMARTWORLD ONE DXP PHASE-2",
    "SMARTWORLD SUITES": "SMARTWORLD SUITES",
    "SMARTWORLD LE COURTYARD": "SMARTWORLD LE COURTYARD",
}

def main(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    hdr = next(it)
    idx = {h: i for i, h in enumerate(hdr)}
    g = lambda r, c: r[idx[c]]

    projects, banks, emps, execs, plans = [], [], [], [], []
    def ix(lst, v):
        v = str(v or "").strip()
        if v not in lst: lst.append(v)
        return lst.index(v)

    L = []
    for r in it:
        name = str(g(r, "Customer Name(Payer Name)") if "Customer Name(Payer Name)" in idx else "").strip()
        if not name:
            # header text may be truncated differently; find by prefix
            for h in idx:
                if h.startswith("Customer Name"): name = str(r[idx[h]] or "").strip(); break
        if not str(g(r, "Sale Order No.") or "").strip(): continue
        proj_raw = str(g(r, "Project Name") or "").strip().upper()
        proj = PROJ_CANON.get(proj_raw, proj_raw)
        bank = str(g(r, "Bank Name") or "").strip().upper() or "—"
        ex = str(g(r, "Executive Name") or "").strip()
        if ex in ("CRM ITCRM IT", "CRM IT"): ex = ""   # unassigned marker in the export
        L.append([
            ix(projects, proj),
            str(g(r, "Sale Order No.") or ""), day(g(r, "Booking Date")),
            str(g(r, "Reg Id.") or ""), name,
            str(g(r, "Unit No.") or ""), str(g(r, "Tower") or ""), str(g(r, "Floor") or ""),
            str(g(r, "Unit Type.") or ""),
            round(num(g(r, "Total Cost(Net Basic Price+ EDC/IDC+Other Charges + Taxes)") if "Total Cost(Net Basic Price+ EDC/IDC+Other Charges + Taxes)" in idx else next(g(r, h) for h in [c for c in idx if c.startswith("Total Cost")])), 2),
            ix(banks, bank),
            ix(plans, g(r, "Payment Plan")),
            str(g(r, "Loan File No.") or ""), day(g(r, "Loan File Date")),
            round(num(g(r, "Loan Sanctioned Amount")), 2), day(g(r, "Loan Sanctioned Date")),
            round(num(g(r, "Loan Disbursed Amount")), 2), round(num(g(r, "Disburse%")), 1),
            round(num(g(r, "Balance Amount")), 2),
            day(g(r, "PTM Date")), day(g(r, "TPT Date")), day(g(r, "BBA Registration Date")),
            ix(emps, g(r, "Employee Name")), ix(execs, g(r, "Executive Name") if ex else ""),
            str(g(r, "Remark") or "").strip(),
            round(num(g(r, "Total Due Incl Tax")), 2),
        ])
    out = {
        "meta": {"asOn": "28 Sep 2026", "epoch": "2022-01-01",
                 "fields": "proj,so,bookDay,regId,name,unit,tower,floor,unitType,cost,bank,plan,fileNo,fileDay,sanctAmt,sanctDay,disbAmt,disbPct,balance,ptmDay,tptDay,bbaDay,emp,exec,remark,due"},
        "PROJECTS": projects, "BANKS": banks, "EMPS": emps, "EXECS": execs, "PLANS": plans, "L": L,
    }
    dest = os.path.join(os.path.dirname(__file__), "..", "src", "data", "loanData.json")
    json.dump(out, open(dest, "w"), separators=(",", ":"), ensure_ascii=False)
    print(len(L), "loans,", len(banks), "banks,", len(emps), "employees,", os.path.getsize(dest) // 1024, "KB")
    print("projects:", projects)

if __name__ == "__main__":
    main(sys.argv[1])
