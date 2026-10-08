import { Suspense, lazy, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import "./assistant.css";

/* The overlay (orb canvas, WebGL voice orb, engine) loads on first open,
 * so the dashboard's first paint stays as light as before. */
const loadOverlay = () => import("./AssistantOverlay");
const AssistantOverlay = lazy(loadOverlay);

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {!open && (
        <button type="button" className="sa-fab" onClick={() => setOpen(true)} onMouseEnter={() => { void loadOverlay(); }}
          aria-label="Ask SmartDB" title="Ask SmartDB (Ctrl+K)">
          <Sparkles /><span>Ask SmartDB</span>
        </button>
      )}
      {open && (
        <Suspense fallback={null}>
          <AssistantOverlay onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
