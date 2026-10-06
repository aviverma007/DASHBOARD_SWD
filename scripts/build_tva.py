#!/usr/bin/env python3
"""Build src/data/tvAnalytics.json — the ACTUALS side of the Target vs
Actual tab — from the two datasets that are already refreshed on every
data drop:

  cpAnalytics.json         (PDRN active bookings → monthly units/TSV/area, rates)
  smartworldInventory.json (INVR stock → tower/config sold-unsold-total)
  targetData.json          (the 41-month timeline the arrays align to)

Run AFTER build_pdrn.py / convert_invr_export.py on every refresh:
  python3 scripts/build_tva.py

TSV basis = Total BSP Net Value (field 6), the same basis as the
Bookings/Overview tabs, so all tabs agree. (The pre-Oct-2026 build used
gross BSP from an older export — numbers shift slightly but are now
consistent app-wide.)
"""
import json, re, collections

D = "/home/claude/DASHBOARD_SWD/src/data"
cp = json.load(open(f"{D}/cpAnalytics.json"))
inv = json.load(open(f"{D}/smartworldInventory.json"))
td = json.load(open(f"{D}/targetData.json"))

MONTHS = [(m["year"], m["month"]) for m in td["months"]]
MIDX = {ym: i for i, ym in enumerate(MONTHS)}


def cfg_bucket(raw: str) -> str:
    t = str(raw).upper()
    if any(k in t for k in ("SHOP", "RETAIL", "ANCHOR", "RESTAURANT", "COMMERCIAL")):
        return "Commercial"
    m = re.search(r"(\d+)\s*BHK", t)
    return f"{m.group(1)} BHK" if m else "Other"


# PDRN actives decoded, keyed by UPPER project name (INVR name space)
ACT = collections.defaultdict(list)
for r in cp["R"]:
    if r[13] != 0:
        continue
    ACT[cp["P"][r[0]].upper()].append({
        "tw": cp["TW"][r[1]], "fl": r[2], "cfg": cfg_bucket(cp["CFG"][r[4]]),
        "area": r[5], "tsv": r[6], "y": r[7], "m": r[8], "unit": str(r[9]),
    })

projects_out = []
global_month = collections.defaultdict(lambda: [0.0, 0.0, 0])  # tsv, area, units

for ip, pname in enumerate(inv["P"]):
    rows = ACT.get(pname, [])
    iu = [u for u in inv["U"] if u[0] == ip]

    tsv_sum = sum(b["tsv"] for b in rows)
    area_sum = sum(b["area"] for b in rows)

    mu = [0] * len(MONTHS)
    mt = [0.0] * len(MONTHS)
    ma = [0.0] * len(MONTHS)
    trend = collections.defaultdict(lambda: [0.0, 0.0, 0])
    for b in rows:
        i = MIDX.get((b["y"], b["m"]))
        if i is None:
            continue   # undated / pre-timeline bookings stay in scalars only
        mu[i] += 1
        mt[i] = round(mt[i] + b["tsv"] / 1e7, 4)
        ma[i] = round(ma[i] + b["area"] / 1e5, 4)
        k = f"{b['y']}-{b['m']:02d}"
        trend[k][0] += b["tsv"]; trend[k][1] += b["area"]; trend[k][2] += 1
        global_month[k][0] += b["tsv"]; global_month[k][1] += b["area"]; global_month[k][2] += 1

    rate_trend = [
        {"key": k, "rate": round(v[0] / v[1]) if v[1] else 0, "units": v[2]}
        for k, v in sorted(trend.items())
    ]

    # towers: stock from INVR, money/rates from PDRN rows on the same name
    tw_stock = collections.defaultdict(lambda: [0, 0])  # total, booked
    for u in iu:
        t = inv["TW"][u[1]]
        tw_stock[t][0] += 1
        if u[8] == 1:
            tw_stock[t][1] += 1
    towers = []
    for t, (tot, booked) in sorted(tw_stock.items(), key=lambda x: -x[1][1]):
        trows = [b for b in rows if b["tw"] == t]
        t_tsv = sum(b["tsv"] for b in trows)
        t_area = sum(b["area"] for b in trows)
        yr = collections.defaultdict(lambda: [0.0, 0.0])
        for b in trows:
            if b["y"] > 0:
                yr[b["y"]][0] += b["tsv"]; yr[b["y"]][1] += b["area"]
        towers.append({
            "name": t, "sold": booked, "unsold": tot - booked, "total": tot,
            "sold_pct": round(booked / tot * 100) if tot else 0,
            "tsv": round(t_tsv / 1e7, 1),
            "avg_rate": round(t_tsv / t_area) if t_area else 0,
            "year_rates": {str(y): round(v[0] / v[1]) for y, v in sorted(yr.items()) if v[1]},
        })

    # configs: INVR buckets; avg_area = sold-average super area
    cfg_agg = collections.defaultdict(lambda: [0, 0, 0.0])  # total, booked, bookedArea
    for u in iu:
        cname = inv["CFG"][u[4]]
        cfg_agg[cname][0] += 1
        if u[8] == 1:
            cfg_agg[cname][1] += 1
            cfg_agg[cname][2] += u[6]
    configs = [
        {"name": c, "sold": v[1], "unsold": v[0] - v[1], "total": v[0],
         "sold_pct": round(v[1] / v[0] * 100) if v[0] else 0,
         "avg_area": round(v[2] / v[1]) if v[1] else round(
             sum(u[6] for u in iu if inv["CFG"][u[4]] == c) / max(sum(1 for u in iu if inv["CFG"][u[4]] == c), 1))}
        for c, v in sorted(cfg_agg.items())
    ]

    units = [
        {"unitNo": b["unit"], "tower": b["tw"], "floor": b["fl"], "cfg": b["cfg"],
         "area": b["area"], "tsv": round(b["tsv"] / 1e7, 2),
         "rate": round(b["tsv"] / b["area"]) if b["area"] else 0,
         "year": b["y"], "month": b["m"]}
        for b in sorted(rows, key=lambda b: (b["y"], b["m"]), reverse=True)[:500]
    ]

    projects_out.append({
        "name": pname, "sold": len(rows),
        "tsv": round(tsv_sum / 1e7, 1), "area": round(area_sum / 1e5, 1),
        "avg_rate": round(tsv_sum / area_sum) if area_sum else 0,
        "monthly_units": mu, "monthly_tsv": [round(x, 2) for x in mt],
        "monthly_area": [round(x, 2) for x in ma],
        "towers": towers, "configs": configs, "units": units,
        "rate_trend": rate_trend,
    })

monthly_rates = [
    {"key": k, "rate": round(v[0] / v[1]) if v[1] else 0, "units": v[2]}
    for k, v in sorted(global_month.items())
]

out = {"monthly_rates": monthly_rates, "projects": projects_out}
json.dump(out, open(f"{D}/tvAnalytics.json", "w"), separators=(",", ":"), ensure_ascii=False)

tot_sold = sum(p["sold"] for p in projects_out)
print(f"{len(projects_out)} projects, {tot_sold} sold, "
      f"TSV ₹{sum(p['tsv'] for p in projects_out):,.1f} Cr, "
      f"latest month: {monthly_rates[-1]['key']} ({monthly_rates[-1]['units']} units)")
for p in projects_out:
    print(f"  {p['name']}: {p['sold']} sold, ₹{p['tsv']} Cr, {len(p['towers'])} towers")
