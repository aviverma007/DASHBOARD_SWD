import { useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import "./pageBanner.css";

/**
 * The one navy page header. Every dashboard tab renders this so the
 * banner is the same height, padding, type and control style on every
 * page. Put page filters in `children` (they land in the filter row);
 * put page tabs / actions in `right` (they sit beside the title).
 */
export function PageBanner({ title, sub, right, center, children, bleed, style, className }: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  /** Centered at the top of the banner — the home for view/tab toggles. */
  center?: ReactNode;
  children?: ReactNode;
  /** Render inside a `.wrap` (18px 22px padding) and bleed to the edges. */
  bleed?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={`pb${className ? " " + className : ""}`}
      style={bleed ? { margin: "-18px -22px 16px", ...style } : style}>
      <div className="pb-top">
        <div>
          <div className="pb-title">{title}</div>
          {sub && <div className="pb-sub">{sub}</div>}
        </div>
        {center && <div className="pb-center">{center}</div>}
        {right}
      </div>
      {children && <div className="pb-filters">{children}</div>}
    </div>
  );
}

/** Segmented pills with an iOS-style sliding "liquid glass" thumb.
 * The gold thumb is one absolutely-positioned element that glides
 * (slight overshoot) to whichever segment is active, so every toggle
 * on every page animates identically. `size="lg"` = page tabs. */
/* The Leads page re-mounts its banner when switching sections (each
 * section renders the banner so its filters live inside it). A fresh
 * mount used to reset the thumb to x:0/opacity:0, which flashed and
 * killed the slide. Cache the last thumb rect per pill-group so a
 * remounted control starts where its predecessor ended and glides. */
const thumbCache = new Map<string, { x: number; w: number }>();

export function BannerPills<K extends string>({ items, value, onChange, size }: {
  items: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void; size?: "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cacheKey = items.map(i => i[0]).join("|");
  const [thumb, setThumb] = useState<{ x: number; w: number; ready: boolean }>(() => {
    const c = thumbCache.get(cacheKey);
    return c ? { ...c, ready: true } : { x: 0, w: 0, ready: false };
  });
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLElement>('[data-on="1"]');
      if (!el) return;
      const next = { x: el.offsetLeft, w: el.offsetWidth };
      thumbCache.set(cacheKey, next);
      setThumb(t => (t.x === next.x && t.w === next.w && t.ready ? t : { ...next, ready: true }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [value, items, cacheKey]);
  return (
    <div ref={ref} className={`pb-pills${size === "lg" ? " pb-pills-lg" : ""}`}>
      <span className="pb-thumb" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w, opacity: thumb.ready ? 1 : 0 }} aria-hidden />
      {items.map(([k, l]) => (
        <button key={k} type="button" data-on={value === k ? "1" : undefined}
          className={`pb-pill${value === k ? " on" : ""}`} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

/** Label + control wrapper for the filter row. */
export function BannerField({ label, children, style }: { label: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={style}>
      <div className="pb-lbl">{label}</div>
      {children}
    </div>
  );
}

/** Inline-style twins for components that build their own controls. */
export const BANNER_LBL: CSSProperties = { display: "block", fontSize: 9.5, lineHeight: "12px", fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 };
export const BANNER_CTL: CSSProperties = { boxSizing: "border-box", height: 34, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: "var(--ink)", backgroundColor: "#fff", border: "1px solid #d8d2c4", borderRadius: 8, padding: "0 10px", outline: "none", cursor: "pointer" };
