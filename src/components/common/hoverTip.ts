/** Lightweight global hover tooltip — one fixed, pointer-transparent
 * card that any chart can drive: showTip(event, html) on
 * enter/move, hideTip() on leave. Dark navy card matching the drill
 * drawer headers; clamps to the viewport; no React re-renders. */

let el: HTMLDivElement | null = null;

function ensure(): HTMLDivElement {
  if (el) return el;
  el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    zIndex: "9999",
    pointerEvents: "none",
    background: "#0f2233",
    color: "#fff",
    border: "1px solid #0e7490",
    borderRadius: "9px",
    padding: "7px 11px",
    fontSize: "12px",
    lineHeight: "1.5",
    fontFamily: "inherit",
    boxShadow: "0 8px 24px rgba(15,34,51,.35)",
    opacity: "0",
    transition: "opacity 0.1s",
    maxWidth: "260px",
  } as CSSStyleDeclaration);
  document.body.appendChild(el);
  return el;
}

function place(x: number, y: number) {
  const t = ensure();
  const pad = 14;
  const r = t.getBoundingClientRect();
  let left = x + pad;
  let top = y - r.height - 10;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - pad;
  if (top < 8) top = y + pad;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${top}px`;
}

export function showTip(e: { clientX: number; clientY: number }, html: string) {
  const t = ensure();
  t.innerHTML = html;
  t.style.opacity = "1";
  place(e.clientX, e.clientY);
}

export function hideTip() {
  if (el) el.style.opacity = "0";
}

/** Convenience: spread onto any element. */
export function tipProps(html: () => string) {
  return {
    onMouseEnter: (e: React.MouseEvent) => showTip(e, html()),
    onMouseMove: (e: React.MouseEvent) => showTip(e, html()),
    onMouseLeave: hideTip,
  };
}
