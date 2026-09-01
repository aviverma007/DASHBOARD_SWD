import { AnimatePresence, motion } from "framer-motion";
import { FF, dayToDate, type FfRecord } from "../../utils/footfallLogic";

/** Second-level slide-over showing ONE site-visit record in full —
 * opened by clicking a row in any records table (tab or drill
 * drawer). Sits above the drill drawer (z 80/81); closes on outside
 * click or ✕. */
export function VisitRecordPanel({ rec, onClose }: { rec: FfRecord | null; onClose: () => void }) {
  const F = ({ k, v, mono }: { k: string; v: string; mono?: boolean }) => (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #eae6da" }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 3, fontFamily: mono ? "monospace" : undefined, wordBreak: "break-word" }}>{v}</div>
    </div>
  );
  const stg = rec && rec.stg >= 0 ? FF.STG[rec.stg] : "—";
  const stgColor = stg === "Booked" ? "#1a7a4a" : stg === "Closed Lost" ? "#b3362c" : "#3d4a63";
  const stgBg = stg === "Booked" ? "#e2f3ec" : stg === "Closed Lost" ? "#fde3e3" : "#eef1f7";
  return (
    <AnimatePresence>
      {rec && (
        <>
          <motion.div key="vrov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 80 }} />
          <motion.div key="vrdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(430px, 92vw)", zIndex: 81, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#0f2233", padding: "16px 20px", borderBottom: "3px solid #0e7490", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#7fb8d4" }}>SITE-VISIT RECORD</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 2, letterSpacing: "0.5px" }}>
                  {rec.opp || "No opportunity number"}
                </div>
              </div>
              <button onClick={onClose} aria-label="Close"
                style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 26px" }}>
              <div style={{ margin: "4px 0 8px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 6, padding: "4px 12px", background: stgBg, color: stgColor }}>{stg}</span>
              </div>
              <F k="Visit date" v={rec.day >= 0 ? dayToDate(rec.day).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "—"} />
              <F k="Opportunity number" v={rec.opp || "—"} mono />
              <F k="Sales gallery" v={rec.g >= 0 ? FF.G[rec.g] : "—"} />
              <F k="Project / campaign" v={rec.p >= 0 ? FF.P[rec.p] : "—"} />
              <F k="Walk-in source" v={rec.src >= 0 ? FF.SRC[rec.src] : "—"} />
              <F k="Channel partner" v={rec.cp >= 0 ? FF.CPN[rec.cp] : "— (not partner-sourced)"} />
              <F k="Customer locality" v={rec.loc >= 0 ? FF.LOC[rec.loc] : "—"} />
              <F k="Age band" v={rec.age >= 0 ? FF.AGE[rec.age] : "—"} />
              <F k="Category" v={rec.cat >= 0 ? FF.CAT[rec.cat] : "—"} />
              <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 12, lineHeight: 1.6 }}>
                Fields come straight from the corresponding Excel row — blanks in the file show as "—".
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
