"""Shared helpers for the live SAP refresh scripts (zrec_from_sap.py, cost_from_sap.py,
dapp_from_sap.py). Pure Python + openpyxl (both on server .28).

The VendorGlobe API loads each SAP report into SQL (app/pdrn_sync.py) and serves the snapshot at
http://127.0.0.1:5002/<feed>/rows as {asOn, loadId, count, rows}; every value is text and every
row carries CALL_KEY (the company / view / project definition of the SAP call it came from).

To keep the dashboard numbers computed exactly as before, the scripts turn those rows back into
the SAME Excel layout the manual exports had (ALV headings, real dates and numbers) and run the
existing Excel builders unchanged.
"""
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pdrn_from_sap import load_env_file, env, clean_num, ENV_FILE  # noqa: E402,F401

DATA = os.path.join(HERE, "..", "src", "data")
DATA_INFO = os.path.join(HERE, "..", "src", "config", "dataInfo.ts")
API = "http://127.0.0.1:5002"


def fetch_rows(feed):
    """GET /<feed>/rows from the API. Returns the answer dict ({} rows when the feed is empty)."""
    import requests
    url = env(f"VG_{feed.upper()}_API_URL", f"{env('VG_API_BASE', API)}/{feed}/rows")
    hdr = {"Accept": "application/json"}
    if env("VG_PDRN_API_TOKEN"):
        hdr["X-PDRN-Token"] = env("VG_PDRN_API_TOKEN")
    r = requests.get(url, headers=hdr, timeout=600)
    if r.status_code != 200:
        raise RuntimeError(f"{url} -> HTTP {r.status_code}: {r.text[:200]}")
    ans = r.json()
    ans["rows"] = [{str(k).upper(): v for k, v in x.items()} for x in ans.get("rows") or []]
    return ans


def load_time(ans):
    """(as_on text "26 Nov 2026, 1:04 PM", iso) of the SQL load."""
    t = datetime.datetime.fromisoformat(ans["asOn"]) if ans.get("asOn") else datetime.datetime.now()
    return f"{t:%d %b %Y}, {t:%I:%M %p}".replace(", 0", ", "), t.isoformat(timespec="seconds")


def to_date(v):
    """'2026-11-24' / '20261124' / '2026-11-24 00:00:00' -> datetime; '0000-00-00' / '' -> None."""
    if v is None or isinstance(v, datetime.datetime):
        return v
    s = re.sub(r"[^0-9]", "", str(v))[:8]
    if len(s) != 8 or s == "00000000":
        return None
    try:
        return datetime.datetime(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except ValueError:
        return None


def to_time(v):
    s = re.sub(r"[^0-9]", "", str(v or ""))[:6]
    if len(s) != 6:
        return None
    try:
        return datetime.time(int(s[:2]), int(s[2:4]), int(s[4:6]))
    except ValueError:
        return None


def to_text(v):
    """Text exactly as the Excel export had it (leading zeros kept); blank -> empty cell."""
    s = "" if v is None else str(v).strip()
    return s or None


def to_id(v):
    """SAP number shown without leading zeros, as the ALV export does ('00010' -> '10', '000' -> '0')."""
    s = to_text(v)
    return (s.lstrip("0") or "0") if s and s.isdigit() else s


def to_num(v):
    f = clean_num(v)
    return 0.0 if f is None else f


def write_xlsx(path, layout, rows, blank=None):
    """layout = [(heading, sap_field, kind)] kind: t text, i id without leading zeros, n number,
    d date, h time.
    Writes one sheet with the ALV headings in order - the same file a manual export gives.
    blank: what an empty text cell holds - None (pandas readers: NaN) or "" (openpyxl readers: keeps
    every row full width, as SAP's own export does)."""
    import openpyxl
    conv = {"t": to_text, "i": to_id, "n": to_num, "d": to_date, "h": to_time}
    wb = openpyxl.Workbook(write_only=True)
    ws = wb.create_sheet("Sheet1")
    ws.append([h for h, _, _ in layout])
    for r in rows:
        vals = [conv[k](r.get(f)) for _, f, k in layout]
        if blank is not None:
            vals = [blank if v is None and k in "ti" else v for v, (_, _, k) in zip(vals, layout)]
        ws.append(vals)
    wb.save(path)


def missing_fields(rows, layout):
    present = set().union(*(r.keys() for r in rows)) if rows else set()
    return sorted({f for _, f, _ in layout} - present)


def set_data_info(prefix, as_on, loaded_iso):
    """<PREFIX>_AS_ON / _LIVE / _LOADED_ISO in src/config/dataInfo.ts (the page's live badge)."""
    with open(DATA_INFO, encoding="utf-8") as fh:
        t = fh.read()
    t = re.sub(rf'export const {prefix}_AS_ON = ".*?";', f'export const {prefix}_AS_ON = "{as_on}";', t)
    t = re.sub(rf'export const {prefix}_LIVE = \w+;',
               f'export const {prefix}_LIVE = {"true" if loaded_iso else "false"};', t)
    t = re.sub(rf'export const {prefix}_LOADED_ISO = ".*?";',
               f'export const {prefix}_LOADED_ISO = "{loaded_iso or ""}";', t)
    with open(DATA_INFO, "w", encoding="utf-8") as fh:
        fh.write(t)


def json_meta(name):
    try:
        d = json.load(open(os.path.join(DATA, name), encoding="utf-8"))
        return d.get("meta") or {}
    except Exception:
        return {}


def patch_meta(name, **kv):
    p = os.path.join(DATA, name)
    d = json.load(open(p, encoding="utf-8"))
    d.setdefault("meta", {}).update(kv)
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(d, fh, separators=(",", ":"), ensure_ascii=False)


def run(main):
    """Common entry: exit 0 rebuilt, 3 nothing new, 1 failed (last data kept)."""
    name = os.path.basename(sys.argv[0])
    try:
        if load_env_file():
            print(f"  settings from {os.path.abspath(ENV_FILE)}")
        sys.exit(main(sys.argv[1:]))
    except SystemExit:
        raise
    except Exception as e:
        print(f"{name} FAILED - the page keeps its last data. Reason: {e}")
        sys.exit(1)
