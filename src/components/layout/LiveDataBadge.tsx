import {
  DATA_AS_ON, DATA_LIVE, DATA_LOADED_ISO, DATA_REFRESH_TIMES, INVR_AS_ON, INVR_LIVE, INVR_LOADED_ISO,
  ZREC_AS_ON, ZREC_LIVE, ZREC_LOADED_ISO, ZALR_AS_ON, ZALR_LIVE, ZALR_LOADED_ISO, DAPP_AS_ON, DAPP_LIVE, DAPP_LOADED_ISO,
} from "../../config/dataInfo";
import "./liveDataBadge.css";

/** Hours after the last SAP load before the dot turns amber: the 5 PM load is followed by the next
 * day's 1 PM load (20 h), so anything older than ~26 h means a scheduled refresh was missed. */
const STALE_HOURS = 26;

/** pdrn = bookings (ZSD_PDRN), invr = inventory / stock register (ZSD_INVR) */
const FEEDS = {
  pdrn: { asOn: DATA_AS_ON, live: DATA_LIVE, iso: DATA_LOADED_ISO, what: "Bookings", report: "ZSD_PDRN" },
  invr: { asOn: INVR_AS_ON, live: INVR_LIVE, iso: INVR_LOADED_ISO, what: "Inventory", report: "ZSD_INVR" },
  zrec: { asOn: ZREC_AS_ON, live: ZREC_LIVE, iso: ZREC_LOADED_ISO, what: "Receipts", report: "ZREC_PRINT" },
  zalr: { asOn: ZALR_AS_ON, live: ZALR_LIVE, iso: ZALR_LOADED_ISO, what: "Cost", report: "ZALR" },
  dapp: { asOn: DAPP_AS_ON, live: DAPP_LIVE, iso: DAPP_LOADED_ISO, what: "Due / undue", report: "ZSD_DAPP" },
};

function ageHours(iso: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (Date.now() - t) / 3_600_000 : null;
}

/** "● Live from SAP · 24 Nov 2026, 1:12 PM · refreshes daily 1 PM & 5 PM"
 * green = live and on schedule, amber = live but a refresh was missed, grey = Excel upload. */
export function LiveDataBadge({ variant = "banner", feed = "pdrn" }: { variant?: "banner" | "home"; feed?: keyof typeof FEEDS }) {
  const { asOn: DATA_AS_ON, live, iso, what, report } = FEEDS[feed];
  if (!live && !DATA_AS_ON) return null;          // not loaded from SAP yet: the page shows its own date
  const age = ageHours(iso);
  const state = !live ? "file" : age !== null && age > STALE_HOURS ? "stale" : "live";
  const title = state === "live"
    ? `${what} data is loaded automatically from SAP (${report}) every day at ${DATA_REFRESH_TIMES}. Reload the page after a refresh to see it.`
    : state === "stale"
      ? `The last automatic SAP refresh was ${DATA_AS_ON}; the scheduled ${DATA_REFRESH_TIMES} refresh has not come through since.`
      : `Data from an uploaded Excel export (${DATA_AS_ON}).`;
  return (
    <span className={`ldb ldb-${variant} ldb-${state}`} title={title}>
      <span className="ldb-dot" aria-hidden />
      {state === "live" && <><b>Live from SAP</b> · updated {DATA_AS_ON} · refreshes daily {DATA_REFRESH_TIMES}</>}
      {state === "stale" && <><b>SAP data</b> · last updated {DATA_AS_ON} · refresh overdue (daily {DATA_REFRESH_TIMES})</>}
      {state === "file" && <>data as on {DATA_AS_ON}</>}
    </span>
  );
}
