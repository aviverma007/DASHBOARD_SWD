/** SINGLE SOURCE OF TRUTH for bookings.
 * Derives the salesPDRN-shaped "active bookings" view from
 * cpAnalytics.json (the full PDRN export: 2,064 actives + 258
 * cancelled, with broker + rebooked flags). Overview, Bookings,
 * Target drill drawers, Reports and Channel Partners all trace back
 * to this one file now — refreshing the data = replacing
 * cpAnalytics.json alone. Verified at consolidation: the active
 * subset matched the old salesPDRN.json row-for-row (2,064) and to
 * the rupee (₹11,205 Cr). */
import raw from "./cpAnalytics.json";

interface CpRawFile {
  P: string[]; TW: string[]; FL: string[]; CFG: string[]; CP: string[];
  R: (number | string)[][];
}
const CD = raw as unknown as CpRawFile;

const ACTIVE = CD.R.filter(r => r[13] === 0);
const years = [...new Set(ACTIVE.map(r => r[7] as number))].sort();

/** salesPDRN-compatible shape (uppercased project names to match INVR). */
export const PDRN_ACTIVE = {
  P: CD.P.map(p => p.toUpperCase()),
  TW: CD.TW,
  FL: CD.FL,
  CFG: CD.CFG,
  R: ACTIVE.map(r => r.slice(0, 12)) as (number | string)[][],
  meta: {
    rows: ACTIVE.length,
    source: "PDRN export",
    years,
  },
};

/** Cancelled rows (status=1) in the same tuple shape + rebooked flag. */
export const PDRN_CANCELLED = CD.R.filter(r => r[13] === 1);
export const PDRN_BROKERS = CD.CP;
