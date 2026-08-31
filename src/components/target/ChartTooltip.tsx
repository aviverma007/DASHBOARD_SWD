import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

/** Renders a floating tooltip positioned near the cursor, above all chart content. */
export function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  // Hug the cursor: sit just above-right of it, flipping side near the
  // viewport edges so the card never detaches or clips off-screen.
  const nearRight = tooltip.x > window.innerWidth - 270;
  const nearTop = tooltip.y < 130;
  const left = nearRight ? tooltip.x - 14 : tooltip.x + 14;
  const top = nearTop ? tooltip.y + 18 : tooltip.y - 12;
  const transform = `${nearRight ? "translateX(-100%)" : ""} ${nearTop ? "" : "translateY(-100%)"}`.trim();
  // Portaled to <body>: pages that zoom their content (e.g. Target's
  // 0.9 wrapper) make Chromium interpret a nested fixed element's
  // coordinates in zoomed units, landing the card ~10% away from the
  // cursor. Outside the wrapper, clientX/Y map 1:1 to the viewport.
  return createPortal(
    <div
      style={{
        position: "fixed",
        left,
        top,
        transform: transform || undefined,
        zIndex: 500,
        background: "#14213d",
        color: "#fff",
        borderRadius: 8,
        padding: "9px 12px",
        fontSize: 12.5,
        lineHeight: 1.6,
        boxShadow: "0 6px 24px rgba(0,0,0,.28)",
        pointerEvents: "none",
        maxWidth: 240,
        whiteSpace: "nowrap",
      }}
    >
      {tooltip.content}
    </div>,
    document.body
  );
}

/** Hook: manages tooltip state + mouse handlers for an SVG element group. */
export function useChartTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function showTooltip(e: React.MouseEvent, content: ReactNode) {
    setTooltip({ x: e.clientX, y: e.clientY, content });
  }
  function moveTooltip(e: React.MouseEvent) {
    setTooltip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  }
  function hideTooltip() {
    setTooltip(null);
  }

  return { tooltip, showTooltip, moveTooltip, hideTooltip };
}

export function tRow(label: string, value: string, color?: string): ReactNode {
  return (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: "#a9b2c7" }}>{label}</span>
      <span style={{ fontWeight: 700, color: color ?? "#fff" }}>{value}</span>
    </div>
  );
}
