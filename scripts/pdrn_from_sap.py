#!/usr/bin/env python3
"""Refresh the dashboard's bookings data (src/data/cpAnalytics.json) LIVE from SAP Production,
instead of the manual ZSD_PDRN Excel export + merge.

Source: the read-only SICF service /sap/zpdrn (class ZCL_PDRN_JSON_HANDLER, transport DS4K913636),
which runs report ZRSD_PROPERTY_DETAIL_REPORT (T-code ZSD_PDRN) and returns its ALV table as JSON.

What it does
  1. Calls the service once per company code (status=all = the report's "All" radio button).
  2. Checks the answer: every company must answer, Booking Status must be ACTIVE / CANCELLED,
     and the active-booking count may not fall below VG_PDRN_MIN_RATIO of the current data.
     ANY failure -> nothing is written, the dashboard keeps the last good data, exit code 1.
  3. Maps the service fields to the PDRN Excel column names and runs build_pdrn.build() - the
     same code the Excel refresh uses, so every page computes exactly as before.
  4. Runs build_tva.py (which first syncs inventory booking status with the PDRN).

Only needs Python 3 + requests (no pandas). On server .28 use C:\\VendorGlobe_API\\python312\\python.exe.
Normally started by scripts/refresh_pdrn_live.ps1 (scheduled 1 PM and 5 PM).

Settings (environment variables; the password is never written to disk or logs):
  VG_PDRN_USER / VG_PDRN_PASSWORD  SAP Production user with ZSD_PDRN access   REQUIRED
  VG_PDRN_URL      default https://vhsmwps4ci.sap.smartworlddevelopers.com:20400/sap/zpdrn
  VG_PDRN_CLIENT   sap-client (default: the system's default client)
  VG_PDRN_BUKRS    company codes, comma separated (default 1010,1070,2010,2070,3070)
  VG_PDRN_WERKS    project codes (default the 8 dashboard projects; "*" = every project of
                   those companies - new launches then appear on the dashboard automatically)
  VG_PDRN_STATUS   all | book | inproc (default all)
  VG_PDRN_VERIFY   "1" to verify TLS (default off: SAP's internal certificate)
  VG_PDRN_TIMEOUT  seconds per company call (default 1800)
  VG_PDRN_MIN_RATIO  default 0.9

Usage
  python scripts/pdrn_from_sap.py                    live refresh
  python scripts/pdrn_from_sap.py --check            fetch + validate only, write nothing
  python scripts/pdrn_from_sap.py --file a.json ...  build from saved service answers (testing)
  python scripts/pdrn_from_sap.py --save DIR         also save each company's raw JSON into DIR
"""
import datetime
import json
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_pdrn  # noqa: E402

DEFAULT_URL = "https://vhsmwps4ci.sap.smartworlddevelopers.com:20400/sap/zpdrn"
# the companies / projects the dashboard covers (same 8 projects as the Excel merge):
#   1010 One DXP Street 1011, One DXP Phase-2 1013 · 1070 Sky Arc 1070, Trump Residences 1072
#   2010 The Edition 2010 · 2070 Nature's Court 2071 · 3070 Le Courtyard 3072, Suites 3073
DEFAULT_BUKRS = "1010,1070,2010,2070,3070"
DEFAULT_WERKS = "1011,1013,1070,1072,2010,2071,3072,3073"

# PDRN Excel column  <-  service field (technical name of the same ALV column)
TEXT = {
    "Project Name": "WNAME",
    "Booking Status": "BUKST",
    "Unit Code": "MATNR",
    "Unit No.": "MAKTX",
    "Tower": "ZTOWER",
    "Floor": "ZFLOOR",
    "BHK": "ZBHK",
    "Latest Customer Name": "KUNRN",
    "Broker Name (SFDC)": "ZBNAME",
    "Payment Plan Name": "ZPPLAN",
}
NUM = {
    "Super Area": "SPBTU",
    "Total BSP Net Value": "TCONTX",
    "Total BSP Net Value (With Tax)": "TCONWTX",
    "TCV(With TAX)after Credit/Debit adj": "TCONWTXAD",
    "Total Demand Amount": "TAOBAMT",
    "Total Demand Amount ( With Tax )": "TAOBAMTX",
    "Total Received": "ZTOT_REC",
    "Total Received with Tax": "ZTOT_REC_TAX",
    "Net Received Including Tax": "ZFM_REC_TAX_SKY",
    "Pending for Clearance": "ZPENDING",
    "Total Due Incl Tax": "ZTDIT",
}
DATE = {
    "SFDC Booking Date": "SFDC_DATE",
    "BBA Date": "BBAL_DAT",
}


def env(k, d=""):
    v = os.environ.get(k)
    return d if v is None or v.strip() == "" else v.strip()


# ---------- value cleaning (SAP JSON -> what pandas would have read from the Excel) ----------

def clean_text(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def clean_num(v):
    """180000 / 180000.0 / "180000.00 " / "1234.50-" (SAP trailing minus) / "" -> float or None."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if not s:
        return None
    neg = s.endswith("-")
    if neg:
        s = s[:-1].strip()
    try:
        f = float(s)
    except ValueError:
        return None
    return -f if neg else f


def clean_date(v):
    """"2026-11-24" / "20261124" / "2026-11-24T00:00:00" -> datetime; "0000-00-00" / "" -> None."""
    if v is None:
        return None
    s = re.sub(r"[^0-9]", "", str(v))[:8]
    if len(s) != 8 or s == "00000000":
        return None
    try:
        return datetime.datetime(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except ValueError:
        return None


def rows_of(answer):
    """The service answer is {"rows": [...]} (/ui2/cl_json) or {"ROWS": [...]} (CALL TRANSFORMATION)."""
    rows = answer.get("rows", answer.get("ROWS"))
    if not isinstance(rows, list):
        raise ValueError("answer has no rows list")
    cnt = answer.get("count", answer.get("COUNT"))
    if cnt is not None and int(cnt) != len(rows):
        raise ValueError(f"count says {cnt} but {len(rows)} rows arrived (truncated answer?)")
    return [{str(k).upper(): v for k, v in r.items()} for r in rows]


def to_record(r):
    rec = {col: clean_text(r.get(f)) for col, f in TEXT.items()}
    rec.update({col: clean_num(r.get(f)) for col, f in NUM.items()})
    rec.update({col: clean_date(r.get(f)) for col, f in DATE.items()})
    return rec


# ---------- fetch ----------

def fetch(bukrs, save_dir=None):
    import requests
    user, pw = env("VG_PDRN_USER"), os.environ.get("VG_PDRN_PASSWORD", "")
    if not user or not pw:
        raise SystemExit("VG_PDRN_USER / VG_PDRN_PASSWORD are not set on this machine.")
    verify = env("VG_PDRN_VERIFY", "0") == "1"
    if not verify:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    params = {"bukrs": bukrs, "status": env("VG_PDRN_STATUS", "all"), "saml2": "disabled"}
    werks = env("VG_PDRN_WERKS", DEFAULT_WERKS)
    if werks != "*":
        params["werks"] = werks
    if env("VG_PDRN_CLIENT"):
        params["sap-client"] = env("VG_PDRN_CLIENT")
    url = env("VG_PDRN_URL", DEFAULT_URL)
    t0 = time.time()
    resp = requests.get(url, params=params, auth=(user, pw), verify=verify,
                        timeout=int(env("VG_PDRN_TIMEOUT", "1800")),
                        headers={"Accept": "application/json"})
    secs = time.time() - t0
    if resp.status_code == 401:
        raise RuntimeError("401 - SAP rejected the user/password (VG_PDRN_USER / VG_PDRN_PASSWORD)")
    if resp.status_code == 403:
        raise RuntimeError("403 - user has no ZSD_PDRN authorization in Production")
    if resp.status_code == 404:
        raise RuntimeError("404 - /sap/zpdrn not found or not activated in SICF")
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
    if "json" not in resp.headers.get("Content-Type", "") and resp.text.lstrip()[:1] != "{":
        raise RuntimeError("SAP returned a web page instead of JSON (login page? check saml2/user)")
    if save_dir:
        os.makedirs(save_dir, exist_ok=True)
        with open(os.path.join(save_dir, f"zpdrn_{bukrs}.json"), "wb") as fh:
            fh.write(resp.content)
    answer = resp.json()
    return answer, secs


# ---------- main ----------

def current_active():
    try:
        cp = json.load(open(build_pdrn.OUT, encoding="utf-8"))
        return sum(1 for r in cp["R"] if r[13] == 0)
    except Exception:
        return 0


def main(argv):
    check_only = "--check" in argv
    save_dir = argv[argv.index("--save") + 1] if "--save" in argv else None
    files = []
    if "--file" in argv:
        files = [a for a in argv[argv.index("--file") + 1:] if not a.startswith("--")]

    raw = []
    if files:
        for f in files:
            raw.extend(rows_of(json.load(open(f, encoding="utf-8"))))
            print(f"  {f}: {len(raw)} rows so far")
    else:
        for b in [x.strip() for x in env("VG_PDRN_BUKRS", DEFAULT_BUKRS).split(",") if x.strip()]:
            answer, secs = fetch(b, save_dir)
            rows = rows_of(answer)
            if not rows:
                raise RuntimeError(f"company {b}: SAP returned 0 rows - refusing to drop a whole company")
            print(f"  company {b}: {len(rows)} rows in {secs:.0f}s")
            raw.extend(rows)

    recs = [to_record(r) for r in raw]
    bad = {r["Booking Status"] for r in recs} - {"ACTIVE", "CANCELLED"}
    if bad:
        raise RuntimeError(f"unexpected Booking Status values {bad} - not loading")
    miss = [k for k in ("Project Name", "Tower", "Floor", "BHK") for r in recs if r[k] is None]
    if miss:
        raise RuntimeError(f"{len(miss)} rows without Project/Tower/Floor/BHK - not loading")
    for r in recs:
        build_pdrn.floor_num(r["Floor"])          # raises on an unknown floor label
    act_new = sum(1 for r in recs if r["Booking Status"] == "ACTIVE")
    act_old = current_active()
    ratio = float(env("VG_PDRN_MIN_RATIO", "0.9"))
    print(f"  {len(recs)} rows, {act_new} active (dashboard has {act_old} now)")
    if act_old and act_new < act_old * ratio:
        raise RuntimeError(f"active bookings fell from {act_old} to {act_new} "
                           f"(below {ratio:.0%}) - looks like incomplete data, not loading")
    if check_only:
        print("check OK - nothing written (--check)")
        return 0

    now = datetime.datetime.now()
    as_on = f"{now:%d %b %Y}, {now:%I:%M %p}".replace(", 0", ", ")
    build_pdrn.build(recs, as_on, "SAP live (ZSD_PDRN service)")
    subprocess.run([sys.executable, os.path.join(HERE, "build_tva.py")], check=True)
    print(f"PDRN refreshed live from SAP - data as on {as_on}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except SystemExit:
        raise
    except Exception as e:  # keep the last good data; the PowerShell wrapper skips the build
        print(f"PDRN live refresh FAILED - dashboard keeps its last data. Reason: {e}")
        sys.exit(1)
