#!/usr/bin/env python3
"""Build the three CRM visit/enquiry datasets from Salesforce exports:

  footfallVisits.json   <- Customer visit export   (sheet with 'Project' col)
  digitalEnquiries.json <- Digital Presales Enquiry export
  cpGalleryVisits.json  <- CP Visits export

Usage:
  python3 scripts/build_crm_visits.py <footfall.xlsx> <digital.xlsx> <cp.xlsx> "<DD Mon YYYY>"

Shapes verified row-for-row against the 22 Sep 2026 build. PII columns
(names, emails, phones, enquiry numbers, rep names, internal notes)
are deliberately excluded; footfall keeps the Opportunity Number only.
"""
import sys, json, datetime, re
import pandas as pd

EPOCH = datetime.datetime(2022, 1, 1)
OUTDIR = "/home/claude/DASHBOARD_SWD/src/data"


def pick_sheet(path, must_have):
    xl = pd.ExcelFile(path)
    for sh in xl.sheet_names:
        head = pd.read_excel(path, sheet_name=sh, nrows=1)
        if all(c in head.columns for c in must_have):
            return pd.read_excel(path, sheet_name=sh)
    raise ValueError(f"No sheet in {path} with columns {must_have}")


def day_of(v):
    """'8/5/2022, 4:57 PM' / datetime / '2026-09-21...' -> (day, hour). -1 unknown."""
    if pd.isna(v):
        return -1, -1
    if isinstance(v, datetime.datetime):
        return (v.replace(tzinfo=None) - EPOCH).days, v.hour
    s = str(v).strip()
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:,\s*(\d{1,2}):(\d{2})\s*(AM|PM))?", s)
    if m:
        d = datetime.datetime(int(m.group(3)), int(m.group(1)), int(m.group(2)))
        hr = -1
        if m.group(4):
            hr = int(m.group(4)) % 12 + (12 if m.group(6) == "PM" else 0)
        return (d - EPOCH).days, hr
    try:
        d = pd.Timestamp(s).to_pydatetime().replace(tzinfo=None)
        return (d - EPOCH).days, d.hour
    except Exception:
        return -1, -1


class Lex:
    """Index list: values stripped, unique, case-insensitively sorted with
    ties kept in first-appearance order (matches the 22 Sep build).
    blank: None -> NaN maps to -1 (default) or to that placeholder string."""
    def __init__(self, series, fixed=None, blank=None):
        self.blank = blank
        seen = list(dict.fromkeys(
            s for v in series.dropna() if (s := str(v).strip())
        ))
        if blank is not None and blank not in seen:
            seen.append(blank)
        vals = sorted(seen, key=str.lower)
        if fixed is not None:  # semantic order first, unknowns appended sorted
            vals = list(fixed) + [v for v in vals if v not in fixed]
        self.L = vals
        self.ix = {v: i for i, v in enumerate(vals)}

    def __call__(self, v):
        s = "" if pd.isna(v) else str(v).strip()
        if not s:
            return self.ix[self.blank] if self.blank is not None else -1
        return self.ix[s]


def _decode(base, lists, row, str_fields=()):
    """JSON row (index space) -> value space, using the base file's lists."""
    out = []
    for j, v in enumerate(row):
        if j in str_fields or not isinstance(v, int):
            out.append(v)
        elif j < len(lists):
            out.append(None if v < 0 else base[lists[j]][v])
        else:
            out.append(v)
    return out


def merge_base(base_path, lists, str_fields=()):
    """Decoded rows of an existing dataset, for delta appends."""
    base = json.load(open(base_path))
    return [_decode(base, lists, r, str_fields) for r in base["R"]], base


def build_footfall(path, as_on, base_path=None):
    df = pick_sheet(path, ["Project", "Sales Gallery to Visit", "Opportunity Number"])
    LISTS = ["G", "P", "SRC", "CPN", "STG", "LOC", "AGE", "CAT"]
    vrows = []   # value-space rows: old history first, then this export
    if base_path:
        old, _ = merge_base(base_path, LISTS, str_fields=(9,))
        vrows += old
    for _, r in df.iterrows():
        day, _hr = day_of(r["Date and Time of Site visit"])
        vrows.append([r["Sales Gallery to Visit"], r["Project"], r["Walk-in Source"],
                      r["Channel Partner"], r["Opportunity Stage"],
                      r["Person Account: Locality"], r["Age"], r["Category"],
                      day, "" if pd.isna(r["Opportunity Number"]) else str(r["Opportunity Number"])])
    cols = list(zip(*vrows))
    G = Lex(pd.Series(cols[0])); P = Lex(pd.Series(cols[1]))
    SRC = Lex(pd.Series(cols[2]), fixed=["Direct", "Channel Partner", "Direct Loyalty", "Digital"])
    CPN = Lex(pd.Series(cols[3])); STG = Lex(pd.Series(cols[4]))
    LOC = Lex(pd.Series(cols[5])); AGE = Lex(pd.Series(cols[6])); CAT = Lex(pd.Series(cols[7]))
    R = [[G(v[0]), P(v[1]), SRC(v[2]), CPN(v[3]), STG(v[4]), LOC(v[5]), AGE(v[6]), CAT(v[7]),
          v[8], v[9]] for v in vrows]
    out = {"G": G.L, "P": P.L, "CPN": CPN.L, "LOC": LOC.L, "AGE": AGE.L, "STG": STG.L,
           "CAT": CAT.L, "SRC": SRC.L, "epoch": "2022-01-01", "R": R,
           "meta": {"rows": len(R), "source": path.split("/")[-1].split("-", 1)[-1], "asOn": as_on}}
    json.dump(out, open(f"{OUTDIR}/footfallVisits.json", "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"footfall: {len(R)} rows, {len(P.L)} projects, {len(CPN.L)} CPs, {len(G.L)} galleries")


def build_digital(path, as_on):
    df = pick_sheet(path, ["Enquiry Number", "Enquiry Sub Source", "Stage"])
    SUB = Lex(df["Enquiry Sub Source"]); PRJ = Lex(df["Project: Project Name"])
    STA = Lex(df["Status"]); AGN = Lex(df["Agency Source"], blank="-")
    OWN = Lex(df["Owner: Full Name"]); STG = Lex(df["Stage"])
    R = []
    for _, r in df.iterrows():
        day, _ = day_of(r["Created Date"])
        R.append([SUB(r["Enquiry Sub Source"]), PRJ(r["Project: Project Name"]), STA(r["Status"]),
                  AGN(r["Agency Source"]), OWN(r["Owner: Full Name"]), STG(r["Stage"]), day])
    out = {"SUB": SUB.L, "PRJ": PRJ.L, "STA": STA.L, "AGN": AGN.L, "OWN": OWN.L, "STG": STG.L,
           "epoch": "2022-01-01", "R": R,
           "meta": {"rows": len(R), "source": path.split("/")[-1].split("-", 1)[-1], "asOn": as_on,
                    "note": "PII columns (names, emails, phone numbers, enquiry numbers) deliberately excluded"}}
    json.dump(out, open(f"{OUTDIR}/digitalEnquiries.json", "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"digital: {len(R)} rows, {len(SUB.L)} sub-sources, {len(OWN.L)} owners")


def build_cpv(path, as_on, base_path=None):
    df = pick_sheet(path, ["Channel Partner", "Visit Type", "No of Visitors"])
    LISTS = ["PRJ", "CPN", "ASG", "STA", "G", "VT"]
    vrows = []
    if base_path:
        old, _ = merge_base(base_path, LISTS)
        vrows += old
    for _, r in df.iterrows():
        day, hr = day_of(r["Date and Time of Site visit"])
        nv = -1 if pd.isna(r["No of Visitors"]) else int(r["No of Visitors"])
        vrows.append([r["Project"], r["Channel Partner"], r["Assigned"],
                      r["Status"], r["Sales Gallery to Visit"], r["Visit Type"], nv, day, hr])
    cols = list(zip(*vrows))
    PRJ = Lex(pd.Series(cols[0])); CPN = Lex(pd.Series(cols[1])); ASG = Lex(pd.Series(cols[2]))
    STA = Lex(pd.Series(cols[3])); G = Lex(pd.Series(cols[4])); VT = Lex(pd.Series(cols[5]))
    R = [[PRJ(v[0]), CPN(v[1]), ASG(v[2]), STA(v[3]), G(v[4]), VT(v[5]), v[6], v[7], v[8]]
         for v in vrows]
    out = {"PRJ": PRJ.L, "CPN": CPN.L, "ASG": ASG.L, "STA": STA.L, "G": G.L, "VT": VT.L,
           "epoch": "2022-01-01", "R": R,
           "meta": {"rows": len(R), "source": path.split("/")[-1].split("-", 1)[-1], "asOn": as_on,
                    "note": "Visitor rep names and internal notes deliberately excluded"}}
    json.dump(out, open(f"{OUTDIR}/cpGalleryVisits.json", "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"cp visits: {len(R)} rows, {len(CPN.L)} CPs, {len(ASG.L)} RMs")


if __name__ == "__main__":
    # --delta: footfall + CP files are incremental exports; append to the
    # existing JSONs instead of replacing them (digital is always a full
    # rolling export and is replaced either way).
    args = [a for a in sys.argv[1:] if a != "--delta"]
    delta = "--delta" in sys.argv
    ffp, dgp, cpp, as_on = args[:4]
    build_footfall(ffp, as_on, base_path=f"{OUTDIR}/footfallVisits.json" if delta else None)
    build_digital(dgp, as_on)
    build_cpv(cpp, as_on, base_path=f"{OUTDIR}/cpGalleryVisits.json" if delta else None)
