import { AnimatePresence, motion } from "framer-motion";
import { DG, type DigRec } from "./digitalShared";
import { dayToDate } from "../../utils/footfallLogic";

/** Second-level slide-over for ONE digital enquiry — opened by
 * clicking a row in the Enquiry records table. Enquiry number will
 * appear here once the export is re-shared with that column included
 * in the dataset. */
export function EnquiryRecordPanel({ rec, onClose }: { rec: DigRec | null; onClose: () => void }) {
  const F = ({ k, v }: { k: string; v: string }) => (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #eae6da" }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 3, wordBreak: "break-word" }}>{v}</div>
    </div>
  );
  const sta = rec && rec.sta >= 0 ? DG.STA[rec.sta] : "—";
  const staColor = sta === "Qualified" ? "#1a7a4a" : sta === "Disqualified" ? "#b3362c" : "#3d4a63";
  const staBg = sta === "Qualified" ? "#e2f3ec" : sta === "Disqualified" ? "#fde3e3" : "#eef1f7";
  return (
    <AnimatePresence>
      {rec && (
        <>
          <motion.div key="enov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 80 }} />
          <motion.div key="endw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(430px, 92vw)", zIndex: 81, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#0f2233", padding: "16px 20px", borderBottom: "3px solid #0e7490", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#7fb8d4" }}>ENQUIRY RECORD</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                  {rec.day >= 0 ? dayToDate(rec.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Digital enquiry"}
                </div>
              </div>
              <button onClick={onClose} aria-label="Close"
                style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 26px" }}>
              <div style={{ margin: "4px 0 8px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 6, padding: "4px 12px", background: staBg, color: staColor }}>{sta}</span>
              </div>
              <F k="Enquiry date" v={rec.day >= 0 ? dayToDate(rec.day).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "—"} />
              <F k="Sub-source / channel" v={rec.sub >= 0 ? DG.SUB[rec.sub] : "—"} />
              <F k="Project" v={rec.p >= 0 ? DG.PRJ[rec.p] : "—"} />
              <F k="Enquiry status" v={sta} />
              <F k="Agency" v={rec.ag >= 0 ? DG.AGN[rec.ag] : "—"} />
              <F k="Presales owner" v={rec.ow >= 0 ? DG.OWN[rec.ow] : "—"} />
              <F k="Opportunity stage" v={rec.stg >= 0 ? DG.STG[rec.stg] : "—"} />
              <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 12, lineHeight: 1.6 }}>
                Enquiry number will show here once the export is re-loaded with that column included.
                Personal contact fields never enter the app.
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
