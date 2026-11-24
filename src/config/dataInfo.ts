/** Date of the underlying data extract (INVR / PDRN upload). Update
 * this one line whenever a fresh export is loaded.
 * Written by scripts/build_pdrn.py (Excel) and scripts/pdrn_from_sap.py (live SAP via SQL). */
export const DATA_AS_ON = "23 Nov 2026";
/** true when the bookings came straight from SAP (ZSD_PDRN service → SQL), false for an Excel upload. */
export const DATA_LIVE = false;
/** ISO time of the SAP load behind DATA_AS_ON ("" for Excel). */
export const DATA_LOADED_ISO = "";
/** Scheduled SAP loads, shown next to the live dot. */
export const DATA_REFRESH_TIMES = "1 PM & 5 PM";
