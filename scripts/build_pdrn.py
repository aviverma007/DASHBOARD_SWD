#!/usr/bin/env python3
"""Build src/data/cpAnalytics.json from a merged PDRN export.

cpAnalytics.json is the SINGLE SOURCE OF TRUTH for bookings (see
src/data/pdrnActive.ts) — Overview, Bookings, Target drills, Reports,
Channel Partners and Home all trace back to it.

Usage: python3 scripts/build_pdrn.py <merged_pdrn.xlsx> "<DD Mon YYYY>"
   (live from SAP instead: scripts/pdrn_from_sap.py, which calls build() below)

Row tuple (verified byte-for-byte against the 22 Sep 2026 build):
 0 projIdx  1 towerIdx  2 floorNum  3 floorLabelIdx  4 cfgIdx(raw BHK)
 5 superArea  6 tsv(Total BSP Net Value)  7 year  8 month (SFDC Booking Date)
 9 unitNo  10 customerName  11 paymentPlan  12 brokerIdx(CP)
 13 status (ACTIVE=0 / CANCELLED=1)
 14 rebooked (CANCELLED row whose unit is ACTIVE again = 1)
 15 recWithTax  16 tcvWithTaxAfterAdj  17 dueInclTax
 18 bookingDay (days since 2022-01-01, -1 none)
 19 recExclTax  20 bspNetExclTax  21 demandExclTax  22 demandWithTax
 23 bbaDay (days since 2022-01-01, -1 = BBA not registered)
 24 netRecInclTax ("Net Received Including Tax")
 25 pendingClearance ("Pending for Clearance")
 26 bspNetWithTax ("Total BSP Net Value (With Tax)")
"""
import sys, json, re, datetime

EPOCH = datetime.datetime(2022, 1, 1)
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "cpAnalytics.json")


def floor_num(label: str) -> float:
    s = str(label).strip().lower()
    if s == "ground floor":
        return 0.0
    if s == "upper ground floor":
        return 0.5
    if s == "second floor":          # Le Courtyard SF level, above ground
        return 1.5
    m = re.match(r"(\d+)-a\s*floor", s)
    if m:
        return int(m.group(1)) + 0.5
    m = re.match(r"(\d+)", s)
    if m:
        return float(m.group(1))
    raise ValueError(f"Unparsed floor label: {label!r}")


# Records passed to build() are dicts keyed by the PDRN Excel column names. Missing values are None
# (the Excel path turns NaN/NaT into None; the live SAP path, scripts/pdrn_from_sap.py, sends None for
# blanks and 0000-00-00 dates). No pandas needed here, so the live refresh runs on a bare Python.

def _missing(v):
    return v is None or (isinstance(v, float) and v != v)


def _s(v):
    """str() the way pandas .astype(str) did it (missing -> 'nan')."""
    return "nan" if _missing(v) else str(v)


def day_of(v):
    if _missing(v):
        return -1
    if hasattr(v, "to_pydatetime"):
        v = v.to_pydatetime()
    return (v.replace(tzinfo=None) - EPOCH).days


def num(v):
    """Amounts are stored rounded to whole rupees (matches 22 Sep build)."""
    if _missing(v):
        return 0
    return round(float(v))


def txt(v):
    return "" if _missing(v) else str(v)


def fnum(v):
    f = float(v)
    return int(f) if f == int(f) else f


def dedupe_active(R):
    """One ACTIVE row per project + unit. The PDRN export sometimes carries a second active row for
    the same unit (e.g. Nature's Court T4-1104, an undated duplicate) — every page reads this file,
    so without this Bookings, Collections and P&L count the unit twice while Overview does not.
    Keep the dated row (latest booking day); drop the rest. Cancelled rows are untouched."""
    best = {}
    for i, r in enumerate(R):
        if r[13] != 0:
            continue
        k = (r[0], str(r[9]).strip().upper())
        j = best.get(k)
        if j is None or (r[18], r[7]) > (R[j][18], R[j][7]):
            best[k] = i
    keep = set(best.values())
    dropped = [R[i] for i, r in enumerate(R) if r[13] == 0 and i not in keep]
    for r in dropped:
        print(f"  duplicate active row dropped: project {r[0]} unit {r[9]} ({r[10]})")
    return [r for i, r in enumerate(R) if r[13] != 0 or i in keep]


def _cats(rows, col, key=None):
    return sorted({_s(r[col]) for r in rows if not _missing(r[col])}, key=key or str.lower)


def build(rows, as_on, source, loaded_iso=None):
    """rows: list of dicts keyed by PDRN column names. Writes cpAnalytics.json + DATA_AS_ON.
    loaded_iso: time of the live SAP load (None = Excel upload) -> DATA_LIVE / DATA_LOADED_ISO."""
    P = _cats(rows, "Project Name")
    TW = _cats(rows, "Tower")
    FL = _cats(rows, "Floor", floor_num)
    CFG = _cats(rows, "BHK")
    CP = _cats(rows, "Broker Name (SFDC)")
    pi = {v: i for i, v in enumerate(P)}
    ti = {v: i for i, v in enumerate(TW)}
    fi = {v: i for i, v in enumerate(FL)}
    ci = {v: i for i, v in enumerate(CFG)}
    bi = {v: i for i, v in enumerate(CP)}

    bad = {_s(r["Booking Status"]) for r in rows} - {"ACTIVE", "CANCELLED"}
    if bad:
        raise ValueError(f"Unknown Booking Status values: {bad}")
    active_units = {_s(r["Unit Code"]) for r in rows if r["Booking Status"] == "ACTIVE"}

    R = []
    for r in rows:
        st = 0 if r["Booking Status"] == "ACTIVE" else 1
        reb = 1 if (st == 1 and _s(r["Unit Code"]) in active_units) else 0
        bk = r["SFDC Booking Date"]
        y, mo = (bk.year, bk.month) if not _missing(bk) else (0, 0)
        R.append([
            pi[_s(r["Project Name"])], ti[_s(r["Tower"])],
            fnum(floor_num(r["Floor"])), fi[_s(r["Floor"])], ci[_s(r["BHK"])],
            num(r["Super Area"]), num(r["Total BSP Net Value"]),
            y, mo, txt(r["Unit No."]), txt(r["Latest Customer Name"]),
            txt(r["Payment Plan Name"]),
            bi.get(_s(r["Broker Name (SFDC)"]), -1),
            st, reb,
            num(r["Total Received with Tax"]),
            num(r["TCV(With TAX)after Credit/Debit adj"]),
            num(r["Total Due Incl Tax"]),
            day_of(bk),
            num(r["Total Received"]),
            num(r["Total BSP Net Value"]),
            num(r["Total Demand Amount"]),
            num(r["Total Demand Amount ( With Tax )"]),
            day_of(r["BBA Date"]),
            num(r["Net Received Including Tax"]),
            num(r["Pending for Clearance"]),
            num(r["Total BSP Net Value (With Tax)"]),
        ])

    R = dedupe_active(R)
    out = {
        "P": P, "TW": TW, "FL": FL, "CFG": CFG, "CP": CP, "R": R,
        "meta": {
            "rows": len(R), "source": source,
            "asOn": as_on, "live": bool(loaded_iso), "loadedAt": loaded_iso or "",
            "fields15plus": "15 recWithTax · 16 tcvWithTaxAfterAdj · 17 dueInclTax · 18 bookingDay · 19 recExclTax · 20 bspNetExclTax · 21 demandExclTax · 22 demandWithTax · 23 bbaDay(-1 none) · 24 netRecInclTax · 25 pendingClearance · 26 bspNetWithTax",
        },
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    # the "data as on" label shown on Overview, Home, Target, Channel Partners, TV, mobile
    info = os.path.join(os.path.dirname(OUT), "..", "config", "dataInfo.ts")
    if os.path.exists(info):
        t = open(info, encoding="utf-8").read()
        t = re.sub(r'export const DATA_AS_ON = ".*?";', f'export const DATA_AS_ON = "{as_on}";', t)
        t = re.sub(r'export const DATA_LIVE = \w+;', f'export const DATA_LIVE = {"true" if loaded_iso else "false"};', t)
        t = re.sub(r'export const DATA_LOADED_ISO = ".*?";', f'export const DATA_LOADED_ISO = "{loaded_iso or ""}";', t)
        open(info, "w", encoding="utf-8").write(t)
    n_act = sum(1 for r in R if r[13] == 0)
    n_reb = sum(1 for r in R if r[14] == 1)
    print(f"{len(R)} rows ({n_act} active / {len(R)-n_act} cancelled / {n_reb} rebooked), "
          f"{len(P)} projects, {len(CP)} brokers")
    print("projects:", P)
    return out


def main(src, as_on):
    import pandas as pd
    df = pd.read_excel(src)
    df = df.astype(object).where(pd.notna(df), None)
    build(df.to_dict("records"), as_on, src.replace("\\", "/").split("/")[-1].split("-", 1)[-1])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
