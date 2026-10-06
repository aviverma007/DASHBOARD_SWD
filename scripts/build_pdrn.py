#!/usr/bin/env python3
"""Build src/data/cpAnalytics.json from a merged PDRN export.

cpAnalytics.json is the SINGLE SOURCE OF TRUTH for bookings (see
src/data/pdrnActive.ts) — Overview, Bookings, Target drills, Reports,
Channel Partners and Home all trace back to it.

Usage: python3 scripts/build_pdrn.py <merged_pdrn.xlsx> "<DD Mon YYYY>"

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
import pandas as pd

EPOCH = datetime.datetime(2022, 1, 1)
OUT = "/home/claude/DASHBOARD_SWD/src/data/cpAnalytics.json"


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


def day_of(v):
    if pd.isna(v):
        return -1
    return (pd.Timestamp(v).to_pydatetime().replace(tzinfo=None) - EPOCH).days


def num(v):
    """Amounts are stored rounded to whole rupees (matches 22 Sep build)."""
    if pd.isna(v):
        return 0
    return round(float(v))


def txt(v):
    return "" if pd.isna(v) else str(v)


def fnum(v):
    f = float(v)
    return int(f) if f == int(f) else f


def main(src, as_on):
    df = pd.read_excel(src)
    P = sorted(df["Project Name"].dropna().astype(str).unique(), key=str.lower)
    TW = sorted(df["Tower"].dropna().astype(str).unique(), key=str.lower)
    FL = sorted(df["Floor"].dropna().astype(str).unique(), key=floor_num)
    CFG = sorted(df["BHK"].dropna().astype(str).unique(), key=str.lower)
    CP = sorted(df["Broker Name (SFDC)"].dropna().astype(str).unique(), key=str.lower)
    pi = {v: i for i, v in enumerate(P)}
    ti = {v: i for i, v in enumerate(TW)}
    fi = {v: i for i, v in enumerate(FL)}
    ci = {v: i for i, v in enumerate(CFG)}
    bi = {v: i for i, v in enumerate(CP)}

    status = df["Booking Status"].astype(str)
    bad = set(status.unique()) - {"ACTIVE", "CANCELLED"}
    if bad:
        raise ValueError(f"Unknown Booking Status values: {bad}")
    active_units = set(df.loc[status == "ACTIVE", "Unit Code"].astype(str))

    R = []
    for _, r in df.iterrows():
        st = 0 if r["Booking Status"] == "ACTIVE" else 1
        reb = 1 if (st == 1 and str(r["Unit Code"]) in active_units) else 0
        bk = r["SFDC Booking Date"]
        y, mo = (bk.year, bk.month) if not pd.isna(bk) else (0, 0)
        R.append([
            pi[str(r["Project Name"])], ti[str(r["Tower"])],
            fnum(floor_num(r["Floor"])), fi[str(r["Floor"])], ci[str(r["BHK"])],
            num(r["Super Area"]), num(r["Total BSP Net Value"]),
            y, mo, txt(r["Unit No."]), txt(r["Latest Customer Name"]),
            txt(r["Payment Plan Name"]),
            bi.get(str(r["Broker Name (SFDC)"]), -1),
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

    out = {
        "P": P, "TW": TW, "FL": FL, "CFG": CFG, "CP": CP, "R": R,
        "meta": {
            "rows": len(R), "source": src.split("/")[-1].split("-", 1)[-1],
            "asOn": as_on,
            "fields15plus": "15 recWithTax · 16 tcvWithTaxAfterAdj · 17 dueInclTax · 18 bookingDay · 19 recExclTax · 20 bspNetExclTax · 21 demandExclTax · 22 demandWithTax · 23 bbaDay(-1 none) · 24 netRecInclTax · 25 pendingClearance · 26 bspNetWithTax",
        },
    }
    json.dump(out, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    n_act = sum(1 for r in R if r[13] == 0)
    n_reb = sum(1 for r in R if r[14] == 1)
    print(f"{len(R)} rows ({n_act} active / {len(R)-n_act} cancelled / {n_reb} rebooked), "
          f"{len(P)} projects, {len(CP)} brokers")
    print("projects:", P)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
