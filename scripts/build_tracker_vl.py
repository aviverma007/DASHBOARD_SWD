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
STATUS_CANON = {"Completed": "Complete", "Unassigned": "Not Committed", "Force Ready": "Forced Ready", "Rejected": "Rejected at quality check"}
TYPES = ["Civil", "Finishing", "MEP", "Others"]
CATS = ["C&P", "Design", "Execution"]

# Exact Sky Arc mapping (reproduces the Power BI Earned Value split: 635.14 / 364.25 / 307.28 / 20.55 Cr)
KNOWN_TYPE = { "": "Others", "blockwork / brickwork": "Civil", "cabling & db fixing": "MEP", "car park marking": "Finishing", "ceiling finishes": "Finishing", "ceiling finishes - pop": "Finishing", "cement plaster/white wash": "Finishing", "civil & structural works": "Civil", "common area finishes": "Finishing", "common area mep fixtures": "MEP", "common area mep works incl. lv": "MEP", "db dressing": "MEP", "dismantling of tower cranes": "Finishing", "doors installation": "Finishing", "drain channel - grating": "MEP", "drainage & sewerage piping": "MEP", "drawing requirement": "Finishing", "dwall": "Civil", "electrical - light fixtures": "MEP", "electrical - lv fixtures (cctv, fapa)": "MEP", "electrical - mv / lv wiring": "MEP", "electrical - panels": "MEP", "electrical - switch sockets & other fittings": "MEP", "electrical - wiring & db dressing": "MEP", "electrical shafts ho": "MEP", "ews": "Civil", "external development": "Others", "external façade - external putty": "Finishing", "external façade - paint 1st coat": "Finishing", "external façade - paint final coat": "Finishing", "fhc shafts ho": "MEP", "finishing & mep works": "Finishing", "firefighting - piping": "MEP", "firefighting - piping & sprinklers": "MEP", "floor finishes": "Finishing", "flooring & dado - toilet & kitchen": "Finishing", "flooring - living & dining, balcony": "Finishing", "glass railing - balconies": "Finishing", "grid & false ceiling": "Finishing", "guide rail": "MEP", "handing over": "Finishing", "hvac - copper & drainage piping, ducting": "MEP", "hvac - indoor & outdoor unit, testing": "MEP", "int. doors - frame fixing": "Finishing", "int. doors - shutter fixing & hardwares": "Finishing", "ips flooring - all bedrooms": "Civil", "landing valve & hose reel": "MEP", "landscaping": "Others", "lift car installation": "MEP", "lift shafts ho": "Finishing", "lift testing & commissioning": "MEP", "light fixtures": "MEP", "main door installation": "Finishing", "mass excavation": "Civil", "mep": "MEP", "modular kitchen": "Finishing", "ms railing - staircase": "Civil", "ms railing - utility balcony": "Civil", "oc application": "Finishing", "oc receipt": "Finishing", "paint - final coat": "Finishing", "paint - putty & 1st coat paint": "Finishing", "phe shafts ho": "MEP", "piling work & excavation": "Civil", "piping": "MEP", "piping with testing & commissioning": "MEP", "plaster": "Finishing", "plumbing - cp fittings & chinaware, testing": "MEP", "plumbing - piping": "MEP", "podium waterproofing": "Finishing", "rcc works": "Civil", "safety screen": "Finishing", "shower partition": "Finishing", "slow speed with complete wiring": "MEP", "snagging & desnagging work": "Finishing", "structure works": "Civil", "sump incl. covers": "MEP", "sump pump": "MEP", "tender event": "Finishing", "terrace all works": "Civil", "upvc door/windows & glazing": "Finishing", "ventilation - ducting": "MEP", "ventilation - fans": "MEP", "wall conduiting & box fixing": "MEP", "wall finishes": "Finishing", "wall finishes - gypsum plaster": "Finishing", "waterproofing - toilet / kitchen": "Civil", "whitegoods": "MEP", "windows installation": "Finishing", "wooden flooring": "Finishing" }
CIVIL_RE = re.compile(r"slab|shear ?wall|column|formwork|shuttering|reinforc|casting|concret|raft|\brcc\b|structur|excavat|pil(e|ing)|d ?wall|"
                      r"diaphragm|masonry|blockwork|brick|layout|setting out|anchor|retaining|footing|foundation|substructure|stair|lintel|beam", re.I)
MEP_RE = re.compile(r"\bMEP\b|HVAC|Electric|Plumb|Fire ?fight|Lift|Elevator|Guide Rail|Slow speed|Conduit|Light fix|FHC|Piping|"
                    r"Landing valve|Ventilation|Drainage|Sewer|Sump|Cabling|\bDB\b|PHE|Whitegoods|\bLV\b|Panels?\b|Drain Channel|"
                    r"STP|WTP|DG\b|Transformer|BMS|CCTV|Fire alarm|Pump", re.I)
OTHER_RE = re.compile(r"external development|landscap|approval|handing over|handover|\bOC\b|drawing|tender|award|PR raise|"
                      r"snag|horticulture|road|boundary wall", re.I)


def type_of(trade):
    t = trade.strip()
    if t.lower() in KNOWN_TYPE:
        return TYPES.index(KNOWN_TYPE[t.lower()])
    if not t:
        return 3
    if MEP_RE.search(t):
        return 2
    if CIVIL_RE.search(t):
        return 0
    if OTHER_RE.search(t):
        return 3
    return 1


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
    s = re.sub(r"^[^\d\-.]+", "", s)           # "USD 0.00", "₹ 0.00"
    try:
        return float(s)
    except ValueError:
        return 0.0


def txt(v):
    s = "" if v is None else str(v).strip()
    return "" if s in ("None", "EMPTY") else re.sub(r"\s+", " ", s)


FLOOR_RE = re.compile(r"floor|basement|stilt|terrace|raft|foundation|lmr|mumty|podium|^l\d|^b\d|^level\b|^ground|^gf$|upper ground", re.I)
TOWER_RE = re.compile(r"^(T\d+|Tower\s+[A-Z0-9]+(\s*\(P\d\))?|Tower\s+[A-Z]\(P\d\))$", re.I)
_TOWER_CANON = {}


def split_loc(loc):
    """Tower = the T1 / Tower A part when present (Edition: "Phase 2 - TA - T3 - 2nd Floor"),
    else the first part. Floor = the first floor-like part after it ("Tower J - 20th Floor - Pour 2")."""
    safe = re.sub(r"\(\s*-\s*(\d)", r"(minus\1", loc)          # keep "(-4) Basement" in one piece
    parts = [p.strip().replace("(minus", "(-") for p in re.split(r"\s*-\s*", safe) if p.strip()]
    if not parts:
        return "Others", ""
    ti = next((i for i, p in enumerate(parts) if TOWER_RE.match(p)), 0)
    tower = parts[ti]
    if tower.upper() in ("DR", "DRAWING", "DRAWINGS"):
        tower = "Drawings"
    tower = _TOWER_CANON.setdefault(tower.lower().replace(" ", ""), tower)   # "D Wall" / "D wall"
    rest = parts[ti + 1:]
    floor = next((p for p in rest if FLOOR_RE.search(p)), rest[-1] if rest else "")
    if tower in ("Procurement", "Drawings", "Tender", "Approvals"):
        floor = ""
    return tower, floor


def floor_rank(lbl):
    l = lbl.lower()
    if not l:
        return 999
    if "raft" in l or "foundation" in l:
        return -9
    m = re.search(r"\(-(\d)\)\s*basement", l) or re.match(r"b(\d)\b", l) or re.search(r"basement\s*(\d)", l)
    if m:
        return -int(m.group(1))
    if l in ("ub", "upper basement", "basement"):
        return -1
    if l in ("lb", "lower basement"):
        return -2
    if "stilt" in l or "ground" in l or l in ("gf", "podium"):
        return 0
    m = re.match(r"l0*(\d+)\s*to\s*l0*(\d+)", l)
    if m:
        return int(m.group(1))
    m = (re.search(r"(\d+)(?:st|nd|rd|th)\s*floor", l) or re.fullmatch(r"l0*(\d+)", l)
         or re.match(r"level\s*(\d+)", l) or re.fullmatch(r"(\d+)", l))
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
    if tower in ("Drawings", "Approvals") or "drawing" in t:
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
        # baseline cost: "Cost" on most projects; One DXP and Nature's Court keep it in a field named "BCWS"
        cost_col = "Cost" if "Cost" in idx else "BCWS" if "BCWS" in idx else None
        if cost_col is None:
            raise SystemExit(f"{path}: no Cost or BCWS column")
        # contractor: the Contractor field when the project has it, else the Organisation
        con_col = "Contractor" if "Contractor" in idx else "Organisation"
        need = ["Task ID", "Task Name", "Status", "Progress", "Baseline Start Date", "Baseline End Date",
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
            c_ = num(g(r, cost_col))
            T.append([
                pi, int(num(g(r, "Task ID"))), txt(g(r, "Task Name")), ix("STATUS", st),
                day(g(r, "Baseline Start Date")), day(g(r, "Baseline End Date")),
                day(g(r, "Planned Start Date")), day(g(r, "Planned End Date")),
                day(g(r, "Actual Start Date")), day(g(r, "Actual End Date")),
                int(num(g(r, "Planned Duration"))), round(num(g(r, "Progress")), 2), round(c_),
                ix("LOCS", loc), ix("TOWERS", tower), ix("FLOORS", floor), floor_rank(floor),
                ix("TRADES", trade), ix("OWNERS", txt(g(r, "Owner"))), ix("CONTRACTORS", txt(g(r, con_col))),
                ix("ORGS", txt(g(r, "Organisation"))),
                1 if txt(g(r, "Critical Task")).lower() == "yes" else 0,
                1 if txt(g(r, "Milestone Tracker")).lower() == "yes" else 0,
                round(num(g(r, "Actual Workforce"))), reasons, type_of(trade), category(tower, trade),
            ])
            n += 1
            cost += c_
        metas[pname] = {"asOn": as_on, "source": os.path.basename(path).split("-", 1)[-1], "tasks": n, "cost": round(cost),
                        "costCol": cost_col, "contractorCol": con_col}
        print(f"{pname}: {n} tasks, baseline cost ₹{cost / 1e7:,.2f} Cr (from {cost_col}), contractor from {con_col}")

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
