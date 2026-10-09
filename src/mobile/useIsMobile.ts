import { useEffect, useState } from "react";

/** Phone layout switch: ≤640px wide. Tablets and desktops keep the existing UI. */
const Q = "(max-width: 640px)";
export function useIsMobile(): boolean {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(Q).matches);
  useEffect(() => {
    const mq = window.matchMedia(Q);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return m;
}
