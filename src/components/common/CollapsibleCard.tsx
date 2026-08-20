import { useState, type ReactNode } from "react";

interface CollapsibleCardProps {
  title: ReactNode;       // card heading text / hint
  children: ReactNode;
  defaultOpen?: boolean;  // true = open on first render (default false)
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps .card with a collapsible body. The gold dash (::before pseudo-
 * element) is replaced by a +/− toggle button on the left of the heading.
 * defaultOpen=true for the cards that should start expanded (KPI donuts,
 * Availability/Unsold bars), defaultOpen=false (default) for the rest.
 */
export function CollapsibleCard({ title, children, defaultOpen = false, className, style }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`card collapsible-card${open ? " cc-open" : ""}${className ? " " + className : ""}`} style={style}>
      <h3>
        <button
          className="cc-toggle"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? "−" : "+"}
        </button>
        {title}
      </h3>
      {open && <div className="cc-body">{children}</div>}
    </div>
  );
}
