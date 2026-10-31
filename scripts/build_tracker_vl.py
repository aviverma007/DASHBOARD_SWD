#!/usr/bin/env python3
"""Build src/data/trackerVL.json from VisiLean "New Table View" task exports
(Tasks tab -> Export, all 55 columns, date range = whole project).

Usage:
  python3 scripts/build_tracker_vl.py "<DD Mon YYYY>" "<PROJECT NAME>" <export.xlsx> [more name/file pairs]

Projects already in trackerVL.json and not named on this run are kept, so the
exports can be loaded one project at a time.

One row per task (the export holds only the lowest-level activities):
  T = [proj, taskId, name, status, bs, be, ps, pe, as, ae, plannedDur, progress,
       cost, loc, tower, floor, floorRank, trade, owner, contractor, org,
       critical, milestone, actualWorkforce, reasons, typeOfWork, category]
  dates = days since 2022-01-01 (-1 none) · cost in rupees (VisiLean "Cost" =
  baseline cost, the value the Earned Value report uses) · reasons = bitmask
  over REASONS (columns marked CHECKED).

Derived:
  tower     first part of Location ("Tower F- 9th Floor" -> Tower F, "DR - …" -> Drawings)
  category  C&P (procurement / tender), Design (drawings), Execution (everything else)
  type      Civil / Finishing / MEP / Others by trade — reproduces the Power BI
            Earned Value split exactly for Sky Arc (635.14 / 364.25 / 307.28 / 20.55 Cr)
"""
import sys, os, re, json, datetime
import openpyxl

EPOCH = datetime.datetime(2022, 1, 1)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "trackerVL.json")
REASONS = ["Workfront", "Material", "Equipment", "Manpower", "External Conditions", "Design"]
STATUS_CANON = {"Completed": "Complete", "Unassigned": "Not Committed", "Force Ready": "Forced Ready"}
TYPES = ["Civil", "Finishing", "MEP", "Others"]
CATS = ["C&P", "Design", "Execution"]

CIVIL = {"civil & structural works", "rcc works", "terrace all works", "dwall", "ews", "piling work & excavation",
         "ips flooring - all bedrooms", "structure works", "blockwork / brickwork", "waterproofing - toilet / kitchen",
         "ms railing - staircase", "ms railing - utility balcony", "mass excavation", "piling", "excavation",
         "raft concreting works", "shuttering", "reinforcement", "concreting", "setting out", "layout works", "masonry works"}
OTHERS = {"external development", "landscaping", ""}
MEP_RE = re.compile(r"\bMEP\b|HVAC|Electric|Plumbing|Firefight|Lift|Guide Rail|Slow speed|Conduit|Light fix|FHC|"
                    r"Piping|Landing valve|Ventilation|Drainage|Sump|Cabling|\bDB\b|PHE|Whitegoods|\bLV\b|Panels|Drain Channel", re.I)
FINISHING_OVERRIDE = {"finishing & mep works", "lift shafts ho"}   # Power BI files these under Finishing


def type_of(trade):
    t = trade.strip().lower()
    if t in CIVIL:
        return 0
    if t in OTHERS:
        return 3
    if t in FINISHING_OVERRIDE:
        return 1
    return 2 if MEP_RE.search(trade) else 1


def day(v):
    if isinstance(v, datetime.datetime):
        return (v - EPOCH).days
    s = str(v or "").strip()
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})", s)
    if m:
        return (datetime.datetime(int(m.group(3)), int(m.group(2)), int(m.group(1))) - EPOCH).days
    return -1


def num(v):
    s = str(v if v is not None else "").replace(",", "").strip()
    if not s or s.upper() == "EMPTY":
        return 0.0
    s = re.sub(r"^[A-Z]{3}\s*", "", s)          # "USD 0.00"
    try:
        return float(s)
    except ValueError:
        return 0.0


def txt(v):
    s = "" if v is None else str(v).strip()
    return "" if s in ("None", "EMPTY") else re.sub(r"\s+", " ", s)


def split_loc(loc):
    parts = [p.strip() for p in re.split(r"\s*-\s*", loc) if p.strip()]
    if not parts:
        return "Others", ""
    tower = parts[0]
    if tower.upper() in ("DR", "DRAWING", "DRAWINGS"):
        tower = "Drawings"
    floor = parts[-1] if len(parts) > 1 else ""
    if tower == "Procurement" or tower == "Drawings":
        floor = ""
    return tower, floor


def floor_rank(lbl):
    l = lbl.lower()
    if not l:
        return 999
    if "raft" in l or "foundation" in l:
        return -9
    m = re.search(r"\(-(\d)\)\s*basement", l) or re.fullmatch(r"b(\d)", l) or re.search(r"basement\s*(\d)", l)
    if m:
        return -int(m.group(1))
    if "stilt" in l or "ground" in l or l in ("gf", "podium"):
        return 0
    m = re.match(r"l0*(\d+)\s*to\s*l0*(\d+)", l)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)(?:st|nd|rd|th)\s*floor", l) or re.fullmatch(r"l0*(\d+)", l)
    if m:
        return int(m.group(1))
    if "terrace" in l:
        return 200
    if "lmr" in l or "mumty" in l:
        return 201
    return 500


def category(tower, trade):
    t = (tower + " " + trade).lower()
    if "procurement" in t or "tender" in t:
        return 0
    if tower == "Drawings" or "drawing" in t:
        return 1
    return 2


def main(as_on, pairs):
    old = json.load(open(OUT)) if os.path.exists(OUT) else None
    keep = {}
    if old:   # decode kept projects back to values so the dictionaries can be rebuilt
        for r in old["T"]:
            pn = old["PROJECTS"][r[0]]
            if pn in [p for p, _ in pairs]:
                continue
            keep.setdefault(pn, []).append(r)

    D = {k: [] for k in ("PROJECTS", "STATUS", "LOCS", "TOWERS", "FLOORS", "TRADES", "OWNERS", "CONTRACTORS", "ORGS")}
    def ix(k, v):
        lst = D[k]
        if v not in lst:
            lst.append(v)
        return lst.index(v)
    T, metas = [], {}

    if old:
        for pn, rows in keep.items():
            pi = ix("PROJECTS", pn)
            metas[pn] = old["META"][pn]
            for r in rows:
                n = list(r)
                n[0] = pi
                for pos, key in ((3, "STATUS"), (13, "LOCS"), (14, "TOWERS"), (15, "FLOORS"), (17, "TRADES"),
                                 (18, "OWNERS"), (19, "CONTRACTORS"), (20, "ORGS")):
                    n[pos] = ix(key, old[key][r[pos]])
                T.append(n)

    for pname, path in pairs:
        pi = ix("PROJECTS", pname)
        ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
        it = ws.iter_rows(values_only=True)
        hdr = next(it)
        idx = {h: i for i, h in enumerate(hdr)}
        need = ["Task ID", "Task Name", "Status", "Cost", "Progress", "Baseline Start Date", "Baseline End Date",
                "Planned Start Date", "Planned End Date", "Actual Start Date", "Actual End Date", "Location", "Trade"]
        miss = [c for c in need if c not in idx]
        if miss:
            raise SystemExit(f"{path}: not a Table View task export, missing {miss}")
        g = lambda r, c: r[idx[c]] if c in idx and idx[c] < len(r) else None
        n = cost = 0
        for r in it:
            if g(r, "Task ID") in (None, ""):
                continue
            loc = txt(g(r, "Location"))
            trade = txt(g(r, "Trade"))
            tower, floor = split_loc(loc)
            st = txt(g(r, "Status"))
            st = STATUS_CANON.get(st, st) or "Not Committed"
            reasons = 0
            for b, c in enumerate(REASONS):
                if str(g(r, c) or "").strip().upper() == "CHECKED":
                    reasons |= 1 << b
            c_ = num(g(r, "Cost"))
            T.append([
                pi, int(num(g(r, "Task ID"))), txt(g(r, "Task Name")), ix("STATUS", st),
                day(g(r, "Baseline Start Date")), day(g(r, "Baseline End Date")),
                day(g(r, "Planned Start Date")), day(g(r, "Planned End Date")),
                day(g(r, "Actual Start Date")), day(g(r, "Actual End Date")),
                int(num(g(r, "Planned Duration"))), round(num(g(r, "Progress")), 2), round(c_),
                ix("LOCS", loc), ix("TOWERS", tower), ix("FLOORS", floor), floor_rank(floor),
                ix("TRADES", trade), ix("OWNERS", txt(g(r, "Owner"))), ix("CONTRACTORS", txt(g(r, "Contractor"))),
                ix("ORGS", txt(g(r, "Organisation"))),
                1 if txt(g(r, "Critical Task")).lower() == "yes" else 0,
                1 if txt(g(r, "Milestone Tracker")).lower() == "yes" else 0,
                round(num(g(r, "Actual Workforce"))), reasons, type_of(trade), category(tower, trade),
            ])
            n += 1
            cost += c_
        metas[pname] = {"asOn": as_on, "source": os.path.basename(path).split("-", 1)[-1], "tasks": n, "cost": round(cost)}
        print(f"{pname}: {n} tasks, baseline cost ₹{cost / 1e7:,.2f} Cr")

    out = {"META": metas, "epoch": "2022-01-01", "REASONS": REASONS, "TYPES": TYPES, "CATS": CATS, **D, "T": T,
           "fields": "proj,taskId,name,status,bs,be,ps,pe,as,ae,plannedDur,progress,cost,loc,tower,floor,floorRank,"
                     "trade,owner,contractor,org,critical,milestone,actualWorkforce,reasons,type,category"}
    json.dump(out, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"{len(T)} tasks in {len(D['PROJECTS'])} projects -> {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 3 or len(a[1:]) % 2:
        raise SystemExit(__doc__)
    main(a[0], [(a[i], a[i + 1]) for i in range(1, len(a), 2)])
