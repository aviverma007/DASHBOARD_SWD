#!/usr/bin/env python3
"""Collections (src/data/collections.json) and EOI / Advance (src/data/eoiData.json) live from SAP.

  VendorGlobe API (app/pdrn_sync.py, feed "zrec") loads ZREC_PRINT (/sap/zrec, all receipts since
  2015) for every company (1010, 1070, 2010, 2070, 3070) into SQL PDRN.dbo.SAP_ZREC at 13:00/17:00
  -> this script reads /zrec/rows -> writes one ZREC print per company in the exact Excel layout of
  the manual prints (same headings, dates, amounts) -> runs build_collections.py and build_eoi.py
  UNCHANGED on them. Run after the PDRN refresh (Collections links receipts to the PDRN bookings).

All companies and all projects: profit centers the builders do not know yet (e.g. One DXP) are
placed by matching their units against the PDRN of the same company (>= 80% of >= 5 units agree);
anything still unplaced is reported, never guessed.

Exit codes: 0 rebuilt · 3 nothing new · 1 failed (nothing written).
Usage: python scripts/zrec_from_sap.py [--force] [--check]
"""
import os
import re
import sys
import tempfile
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sap_live as sl  # noqa: E402

# ZSD_REC_PRINT_NEW field catalogue (FORM build_fieldcat), in ALV order: heading, field, kind
LAYOUT = [
    ("Company Code", "COMP_CODE", "t"), ("Profit Center", "ZPRCTR", "t"), ("Sales Order", "SO_NO", "t"),
    ("Latest Customer Code", "ZPAYER", "t"), ("Latest Customer Name", "ZPAYER_NAME", "t"),
    ("Latest Customer Reg. ID", "ZPAYER_ID", "t"), ("Registration No.", "REG_NO", "t"),
    ("Document Number", "BELNR", "t"), ("Fiscal Year", "FISCAL", "t"), ("Cust. Code", "CUST_CODE", "t"),
    ("Name", "NAME", "t"), ("Unit Address", "UNIT_ADD", "t"), ("Unit Type", "UNIT_TYPE", "t"),
    ("Tower Name", "TOWER", "t"), ("Receipt Date", "RECEIPT_DATE", "d"), ("Bank Name", "BANK_NAME", "t"),
    ("Instrument No.", "INST_NO", "t"), ("Instrument Date", "INST_DATE", "d"),
    ("Mode of Payment", "PAYMENT_MODE", "t"), ("Amount", "AMOUNT", "n"), ("CGST", "CGST", "n"),
    ("SGST", "SGST", "n"), ("Interest", "INTEREST", "n"), ("Extra Amt", "EXTRA_AMT", "n"),
    ("Net Amount", "NET_AMT", "n"), ("Payment Type", "PAYMENT_TYPE", "t"), ("Printing Date", "PRINT_DATE", "d"),
    ("DOCUMENT TYPE", "H_BLART", "t"), ("Cleared Doc", "ZCLEARED_DOC", "t"), ("Charge Type", "ZCHARGE_TYPE", "t"),
    ("Receipt Status", "RECEIPT_STATUS", "t"), ("Clearing/Bounce Date", "CANCEL_DATE", "d"),
    ("Customer Status", "CUST_STATUS", "t"), ("Clearing Bank Name", "CLEAR_BANK", "t"),
    ("Clearing Date", "CLEAR_DATE", "d"), ("Print Copy", "CUST_COPY", "t"), ("Print Date", "PRT_DATE", "d"),
    ("Print Time", "PRT_TIME", "h"), ("User", "USER", "t"), ("Bar Code", "BARCODE", "t"),
    ("Print Status", "PRINT_STATUS", "t"), ("Booking Date", "ZBOOK", "d"), ("Allotment Date", "ZALLOT", "d"),
    ("State", "ZSTATE", "t"), ("Country", "ZCOUNTRY", "t"), ("PIN Code", "ZPINCODE", "t"), ("City", "ZCITY", "t"),
    ("Reference", "ZXBLNR", "t"), ("Header Reference 1", "XREF1_HD", "t"), ("Header Reference 2", "XREF2_HD", "t"),
    ("Instrument Details", "SGTXT", "t"),
]
# fields the builders actually read - must exist in the SAP answer
NEEDED = {"ZPRCTR", "RECEIPT_DATE", "CUST_CODE", "ZPAYER_NAME", "UNIT_ADD", "BELNR", "NET_AMT",
          "RECEIPT_STATUS", "PAYMENT_TYPE", "PAYMENT_MODE", "BANK_NAME", "INST_NO", "CANCEL_DATE",
          "CLEAR_BANK", "ZCHARGE_TYPE", "CUST_STATUS", "ZALLOT"}

# PDRN project -> company code (for placing unknown profit centers by unit)
COMPANY_OF = [("one dxp", "1010"), ("sky arc", "1070"), ("trump", "1070"), ("edition", "2010"),
              ("nature", "2070"), ("courtyard", "3070"), ("suites", "3070")]
FRIENDLY = {"one dxp street": "One DXP Street", "one dxp phase-2": "One DXP Phase-2",
            "sky arc": "Sky Arc", "the edition": "The Edition", "suites": "Suites",
            "le courtyard": "Le Courtyard", "trump residences gurgaon": "Trump Residences"}
unit_key = lambda u: re.sub(r"\s+", "", str(u or "")).upper()


def company_of(pdrn_name):
    n = pdrn_name.lower()
    return next((c for k, c in COMPANY_OF if k in n), None)


def friendly(pdrn_name):
    n = re.sub(r"^smartworld\s+", "", pdrn_name.strip(), flags=re.I).lower()
    return FRIENDLY.get(n, n.title())


def learn_profit_centers(rows, known_prefixes):
    """{pc: pdrn project name} for full profit centers the builders do not know, placed by unit."""
    try:
        import json
        cp = json.load(open(os.path.join(sl.DATA, "cpAnalytics.json"), encoding="utf-8"))
    except Exception:
        return {}, {}
    by_co = defaultdict(lambda: defaultdict(set))          # company -> unit -> {pdrn projects}
    for r in cp["R"]:
        p = cp["P"][r[0]]
        co = company_of(p)
        if co:
            by_co[co][unit_key(r[9])].add(p)
    units = defaultdict(set)
    for r in rows:
        pc = sl.to_text(r.get("ZPRCTR")) or ""
        if len(pc) >= 6 and not any(pc.startswith(k) for k in known_prefixes):
            u = unit_key(r.get("UNIT_ADD"))
            if u:
                units[pc].add(u)
    learned, unsure = {}, {}
    for pc, us in units.items():
        pool = by_co.get(pc[:3] + "0", {})
        votes = Counter(p for u in us for p in pool.get(u, ()))
        hit = sum(votes.values())
        if votes and hit >= 5 and votes.most_common(1)[0][1] >= 0.8 * hit:
            learned[pc] = votes.most_common(1)[0][0]
        else:
            unsure[pc] = f"{len(us)} units, {hit} PDRN matches"
    return learned, unsure


def place_short_profit_centers(rows, bc, be, company):
    """Receipts with a SHORT or blank profit center ('1070', '') in a company with several projects
    (1010 One DXP Street / Phase-2, 1070 Sky Arc / Trump, 3070 Le Courtyard / Suites) would all fall to
    the company default (1070 -> Trump). When the receipt's unit is an active or cancelled PDRN unit of
    exactly one project of that company, give the row that project's full profit center instead (a
    stand-in "SW…" code where SAP has none we know). Rows without a unit keep the builders' rules
    (the customer's other receipts, then the company default)."""
    import json
    try:
        cp = json.load(open(os.path.join(sl.DATA, "cpAnalytics.json"), encoding="utf-8"))
    except Exception:
        return Counter()
    units = defaultdict(set)                            # (company, unit) -> {pdrn project}
    for r in cp["R"]:
        p = cp["P"][r[0]]
        co = company_of(p)
        if co:
            units[(co, unit_key(r[9]))].add(p)
    per_co = defaultdict(set)
    for (co, _), ps in units.items():
        per_co[co] |= ps
    multi = {co for co, ps in per_co.items() if len(ps) > 1}
    # project -> full profit center the builders know (else a stand-in code, added to both builders)
    pc_of = {}
    for pc, fr in bc.PC_PROJECT:
        pd_name = bc.PDRN_PROJECT.get(fr)
        if pd_name and len(pc) >= 6:
            pc_of.setdefault(pd_name.upper(), pc)
    known = [p for p, _ in bc.PC_PROJECT if len(p) >= 6]
    moved = Counter()
    for r in rows:
        co = company(r)
        if co not in multi:
            continue
        pc = sl.to_text(r.get("ZPRCTR")) or ""
        if len(pc) >= 6 and any(pc.startswith(k) for k in known):
            continue                                    # a full, known profit center: keep it
        cands = units.get((co, unit_key(r.get("UNIT_ADD"))))
        if not cands or len(cands) != 1:
            continue
        proj = next(iter(cands))
        code = pc_of.get(proj.upper())
        if not code:
            code = "SW" + re.sub(r"[^A-Z0-9]", "", proj.upper())[-8:]
            pc_of[proj.upper()] = code
            bc.PC_PROJECT.append((code, friendly(proj)))
            bc.PDRN_PROJECT.setdefault(friendly(proj), proj)
            be.PC_PROJECT.append((code, proj.upper()))
        r["ZPRCTR"] = code
        moved[friendly(proj)] += 1
    return moved


def main(argv):
    force, check = "--force" in argv, "--check" in argv
    ans = sl.fetch_rows("zrec")
    rows = ans["rows"]
    if not rows:
        print("  SQL table PDRN.dbo.SAP_ZREC is empty - the API has not loaded ZREC yet (see /zrec/health). "
              "Collections / EOI keep their current data.")
        return 3
    load_id = ans.get("loadId")
    if load_id is not None and load_id == sl.json_meta("collections.json").get("loadId") and not force and not check:
        print(f"  ZREC SQL load #{load_id} is already on the dashboard - nothing new")
        return 3
    as_on, iso = sl.load_time(ans)
    gone = sorted(NEEDED - set().union(*(r.keys() for r in rows)))
    if gone:
        raise RuntimeError(f"ZREC no longer returns field(s) {gone} - report changed? Not loading.")
    company = lambda r: ((sl.to_text(r.get("CALL_KEY")) or "").split(" ")[0]   # "1010 2024" -> 1010
                         or sl.to_text(r.get("COMP_CODE")) or "x")
    per_co = Counter(company(r) for r in rows)
    print(f"  ZREC SQL snapshot #{load_id}: {len(rows)} receipts, loaded from SAP {as_on} · "
          + ", ".join(f"{k}: {v}" for k, v in sorted(per_co.items())))

    import build_collections as bc
    import build_eoi as be
    learned, unsure = learn_profit_centers(rows, [p for p, _ in bc.PC_PROJECT])
    for pc, pdrn in sorted(learned.items()):
        bc.PC_PROJECT.append((pc, friendly(pdrn)))
        bc.PDRN_PROJECT.setdefault(friendly(pdrn), pdrn)
        if not any(pc.startswith(k) for k, _ in be.PC_PROJECT):
            be.PC_PROJECT.append((pc, pdrn.upper()))
        print(f"  profit center {pc} -> {friendly(pdrn)} (matched by unit against the PDRN)")
    for pc, why in sorted(unsure.items()):
        print(f"  profit center {pc}: project not certain ({why}) - its customers use their other receipts / company default")
    moved = place_short_profit_centers(rows, bc, be, company)
    if moved:
        print("  short/blank profit centers placed by unit: " + ", ".join(f"{k} {v}" for k, v in sorted(moved.items())))

    import json
    col_json, eoi_json = (os.path.join(sl.DATA, n) for n in ("collections.json", "eoiData.json"))
    try:
        old_n = len(json.load(open(col_json, encoding="utf-8"))["R"])
    except Exception:
        old_n = 0
    ratio = float(sl.env("VG_ZREC_MIN_RATIO", "0.9"))

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:   # Windows: builders may still hold the files
        paths = []
        groups = defaultdict(list)
        for r in rows:
            groups[company(r)].append(r)
        for co, rs in sorted(groups.items()):
            rs.sort(key=lambda r: (str(r.get("RECEIPT_DATE") or ""), str(r.get("BELNR") or "")))
            p = os.path.join(tmp, f"{co}.xlsx")          # file name = company (the builders use it)
            sl.write_xlsx(p, LAYOUT, rs, blank="")
            paths.append(p)
        if check:
            print(f"check OK - {len(paths)} company prints prepared, nothing written (--check)")
            return 0
        backup = {pth: open(pth, "rb").read() for pth in (col_json, eoi_json) if os.path.exists(pth)}
        try:
            bc.main(paths)
            new_n = len(json.load(open(col_json, encoding="utf-8"))["R"])
            if old_n and new_n < old_n * ratio:
                raise RuntimeError(f"receipts fell from {old_n} to {new_n} (below {ratio:.0%}) - not loading")
            be.main(paths)
        except BaseException:
            for pth, b in backup.items():               # put the last good data back
                open(pth, "wb").write(b)
            raise

    src = f"SAP live (ZREC_PRINT via SQL PDRN.dbo.SAP_ZREC, load #{load_id}, {as_on})"
    sl.patch_meta("collections.json", loadId=load_id, loadedAt=iso, source=src)
    sl.patch_meta("eoiData.json", loadId=load_id, loadedAt=iso, source=src)
    sl.set_data_info("ZREC", as_on, iso)
    print(f"Collections + EOI refreshed live from SAP - data as on {as_on}")
    return 0


if __name__ == "__main__":
    sl.run(main)
