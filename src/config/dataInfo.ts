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
/** Inventory (INVR) data: same idea as the three DATA_* lines, for the Inventory page badge.
 * Written by scripts/convert_invr_export.py (Excel) and scripts/invr_from_sap.py (live SAP via SQL). */
export const INVR_AS_ON = "23 Nov 2026";
export const INVR_LIVE = false;
export const INVR_LOADED_ISO = "";
/** Collections + EOI (ZREC_PRINT), Cost (ZALR) and Due / Undue (ZSD_DAPP) - same three values each.
 * Written by scripts/zrec_from_sap.py, cost_from_sap.py and dapp_from_sap.py (live SAP via SQL). */
export const ZREC_AS_ON = "";
export const ZREC_LIVE = false;
export const ZREC_LOADED_ISO = "";
export const ZALR_AS_ON = "";
export const ZALR_LIVE = false;
export const ZALR_LOADED_ISO = "";
export const DAPP_AS_ON = "";
export const DAPP_LIVE = false;
export const DAPP_LOADED_ISO = "";
