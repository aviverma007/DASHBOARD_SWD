import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  /** Formats the in-flight value; defaults to Indian-locale integer. */
  format?: (v: number) => string;
  style?: React.CSSProperties;
  className?: string;
}

/** Count-up ticker (the 21st.dev "Number Ticker" pattern): springs from
 * 0 to `value` the first time it scrolls into view, and springs to any
 * new value afterwards (e.g. when filters change). Renders text only —
 * no layout shift, no transform — so it's safe anywhere, including
 * inside the zoomed page wrappers. */
export function AnimatedNumber({ value, format, style, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 30, stiffness: 160 });
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(
    () =>
      spring.on("change", (v) => {
        if (ref.current) {
          ref.current.textContent = fmt.current ? fmt.current(v) : Math.round(v).toLocaleString("en-IN");
        }
      }),
    [spring]
  );

  return (
    <span ref={ref} style={style} className={className}>
      {format ? format(0) : "0"}
    </span>
  );
}
