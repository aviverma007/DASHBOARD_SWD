import { useLayoutEffect, useRef, useState } from "react";

/** Tracks an element's content width so SVG charts can lay themselves
 * out to exactly fill their card (instead of stretching a fixed-size
 * viewBox, which distorts text, or floating centred at natural size). */
export function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}
