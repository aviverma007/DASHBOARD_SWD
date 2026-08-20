import { useState, type ReactNode } from "react";

interface CollapsibleCardProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps .card with a collapsible body. When collapsed, renders only the
 * header row (title + toggle button) with compact padding — no blank
 * body space. When expanded, full card padding is restored.
 */
export function CollapsibleCard({ title, children, defaultOpen = false, className, style }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`card${className ? " " + className : ""}`}
      style={{
        ...style,
        padding: open ? undefined : "11px 20px", // compact when collapsed
      }}
    >
      <h3
        style={{ marginBottom: open ? undefined : 0, cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen(v => !v)}
      >
        <button
          className="cc-toggle"
          onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
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
