#!/usr/bin/env python3
"""Build src/data/projectTracker.json from a construction-schedule
export (VisiLean/MS Project style, one sheet, WBS rows).

Usage: python3 scripts/build_tracker.py "<PROJECT NAME>" <file.xlsx> [more pairs...]
"""
import sys, os, json, re, datetime
import openpyxl

EPOCH = datetime.datetime(2022, 1, 1)

def pday(v):
    if isinstance(v, datetime.datetime):
        return (v - EPOCH).days
    s = str(v or "").strip()
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", s)
    if m:
        return (datetime.datetime(int(m.group(3)), int(m.group(2)), int(m.group(1))) - EPOCH).days
    return -1

def floor_rank(lbl):
    if not lbl: return 999
    l = lbl.lower()
    if "raft" in l: return -6
    m = re.search(r"\(-(\d)\)\s*basement", l)
    if m: return -int(m.group(1))
    m = re.fullmatch(r"b(\d)", l)
    if m: return -int(m.group(1))
    if "stilt" in l: return 0
    m = re.search(r"(\d+)(?:st|nd|rd|th)\s*floor", l)
    if m: return int(m.group(1))
    if "vertical" in l: return 900
    if "terrace" in l: return 901
    return 500

def parse_loc(loc):
    """-> (tower, floorLabel, floorRank). Handles both "T6 - 9th Floor"
    and the newer "Tower D- 5th Floor" / "T1 -3rd Floor" spellings."""
    if not loc or loc == "0": return ("", "", 999)
    norm = re.sub(r"\s*-\s*", " - ", loc)
    parts = [p.strip() for p in norm.split(" - ") if p.strip()]
    tower = ""
    for p in parts:
        if re.fullmatch(r"T\d+", p) or re.fullmatch(r"Tower\s+[A-Z0-9]+(\(P\d\))?", p):
            tower = p; break
    if not tower:
        if loc.startswith("EWS"): tower = "EWS"
        elif "Clubhouse" in loc: tower = "Clubhouse"
        elif "NTA" in loc: tower = "NTA"
        else: tower = parts[0]
    fl = parts[-1] if len(parts) > 1 else ""
    if fl == tower or re.fullmatch(r"T\d+", fl): fl = ""
    return (tower, fl, floor_rank(fl))

def main(args):
    pairs = [(args[i], args[i + 1]) for i in range(0, len(args), 2)]
    projects, statuses, trades, owners, towers, floors = [], [], [], [], [], []
    def ix(lst, v):
        v = str(v or "").strip()
        if v not in lst: lst.append(v)
        return lst.index(v)
    T = []
    outlines = []          # per-row outline number, aligned with T
    for pname, path in pairs:
        pi = ix(projects, pname)
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.worksheets[0]
        it = ws.iter_rows(values_only=True)
        hdr = next(it)
        idx = {h: i for i, h in enumerate(hdr)}
        for r in it:
            name = str(r[idx["Task name"]] or "").strip()
            outline = str(r[idx["Outline Number"]] or "")
            if not name or not outline: continue
            depth = outline.count(".")
            pct = round(float(r[idx["Percent Complete"]] or 0), 1)
            loc = str(r[idx["Location"]] or "").strip()
            tower, fl, frank = parse_loc(loc)
            outlines.append((pi, outline))
            T.append([
                pi, name, depth, pct,
                ix(statuses, r[idx["Status"]]),
                pday(r[idx["Planned Start"]]), pday(r[idx["Planned End"]]),
                pday(r[idx["Actual Start"]]), pday(r[idx["Actual End"]]),
                pday(r[idx["Baseline End Date"]]),
                ix(trades, r[idx["Trade"]]), ix(owners, r[idx["Owner"]]),
                ix(towers, tower), ix(floors, fl), frank,
            ])
    # leaf = a row no other row claims as parent (exact activity set,
    # robust across exports whose WBS depth differs per project)
    parents = {(pi, o.rsplit(".", 1)[0]) for pi, o in outlines if "." in o}
    for row, (pi, o) in zip(T, outlines):
        row.append(0 if (pi, o) in parents else 1)
    out = {
        "meta": {"asOn": "28 Sep 2026", "epoch": "2022-01-01",
                 "fields": "projIdx,name,depth,pct,statusIdx,ps,pe,as,ae,be,tradeIdx,ownerIdx,towerIdx,floorIdx,floorRank,leaf"},
        "PROJECTS": projects, "STATUS": statuses, "TRADES": trades,
        "OWNERS": owners, "TOWERS": towers, "FLOORS": floors, "T": T,
    }
    dest = os.path.join(os.path.dirname(__file__), "..", "src", "data", "projectTracker.json")
    json.dump(out, open(dest, "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"{len(T)} tasks, {sum(1 for r in T if r[-1])} leaf activities, {len(trades)} trades, {len(owners)} owners, {len(towers)} towers, {os.path.getsize(dest)//1024} KB")
    print("towers:", towers)
    print("statuses:", statuses)

if __name__ == "__main__":
    main(sys.argv[1:])
