import { DATA_AS_ON, DATA_LIVE, DATA_LOADED_ISO, DATA_REFRESH_TIMES } from "../../config/dataInfo";
import "./liveDataBadge.css";

/** Hours after the last SAP load before the dot turns amber: the 5 PM load is followed by the next
 * day's 1 PM load (20 h), so anything older than ~26 h means a scheduled refresh was missed. */
const STALE_HOURS = 26;

function ageHours(): number | null {
  if (!DATA_LOADED_ISO) return null;
  const t = new Date(DATA_LOADED_ISO).getTime();
  return Number.isFinite(t) ? (Date.now() - t) / 3_600_000 : null;
}

/** "● Live from SAP · 24 Nov 2026, 1:12 PM · refreshes daily 1 PM & 5 PM"
 * green = live and on schedule, amber = live but a refresh was missed, grey = Excel upload. */
export function LiveDataBadge({ variant = "banner" }: { variant?: "banner" | "home" }) {
  const age = ageHours();
  const state = !DATA_LIVE ? "file" : age !== null && age > STALE_HOURS ? "stale" : "live";
  const title = state === "live"
    ? `Bookings data is loaded automatically from SAP (ZSD_PDRN) every day at ${DATA_REFRESH_TIMES}. Reload the page after a refresh to see it.`
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
