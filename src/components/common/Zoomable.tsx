import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Wraps any card and adds a maximize (⛶) button in its top-right.
 * Clicking it opens the same content enlarged in a centred overlay;
 * clicking OUTSIDE the enlarged card, pressing Esc, or the ✕ button
 * closes it. Content renders twice (inline + enlarged) so charts stay
 * live and interactive in both. Portaled to <body> so page zoom
 * wrappers can't misplace it. */
export function Zoomable({ children, title, btnTop = 10, btnRight = 10 }: {
  children: ReactNode; title?: string;
  /** Button position relative to the wrapper — chart-level wrappers
   * pass negative top so the button floats up into the CARD's
   * top-right corner (above the h3/caption) instead of covering the
   * first bar's value. */
  btnTop?: number; btnRight?: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button
        onClick={() => setOpen(true)}
        aria-label="Maximize"
        title="Maximize"
        style={{
          position: "absolute", top: btnTop, right: btnRight, zIndex: 5,
          width: 26, height: 26, borderRadius: 7, border: "1px solid #e4e0d6",
          background: "rgba(255,255,255,.92)", color: "#8a94a6", fontSize: 13,
          cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#0e7490"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#8a94a6"; }}
      >⛶</button>
      {children}
      {open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,28,54,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "relative", width: "min(1150px, 96vw)", maxHeight: "92vh", overflowY: "auto", background: "#f6f4ef", borderRadius: 16, boxShadow: "0 24px 70px rgba(15,28,54,.45)", padding: "22px 26px" }}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Minimize"
              title="Minimize"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 6, width: 30, height: 30, borderRadius: 8, border: "none", background: "#0f2233", color: "#fff", fontSize: 14, cursor: "pointer" }}
            >✕</button>
            {title && <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#14213d", marginBottom: 12 }}>{title}</div>}
            {children}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
