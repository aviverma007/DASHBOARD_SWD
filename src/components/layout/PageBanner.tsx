import type { ReactNode, CSSProperties } from "react";
import "./pageBanner.css";

/**
 * The one navy page header. Every dashboard tab renders this so the
 * banner is the same height, padding, type and control style on every
 * page. Put page filters in `children` (they land in the filter row);
 * put page tabs / actions in `right` (they sit beside the title).
 */
export function PageBanner({ title, sub, right, children, bleed, style, className }: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
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
        {right}
      </div>
      {children && <div className="pb-filters">{children}</div>}
    </div>
  );
}

/** Segmented pills (period modes, view toggles). */
export function BannerPills<K extends string>({ items, value, onChange }: {
  items: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void;
}) {
  return (
    <div className="pb-pills">
      {items.map(([k, l]) => (
        <button key={k} type="button" className={`pb-pill${value === k ? " on" : ""}`} onClick={() => onChange(k)}>{l}</button>
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
