/** macOS-style magnifying dock (adapted from a 21st.dev community
 * component). Changes for this codebase: removed the Next.js
 * "use client" directive, cn imported from src/lib/utils, and
 * DockItem accepts onClick so items can act as nav buttons, and the
 * whole dock supports orientation="vertical" (mouseY-driven
 * magnification, labels to the side) for a left-edge rail. */
import {
  motion,
  type MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
  AnimatePresence,
} from "framer-motion";
import {
  Children,
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/utils";

const DOCK_HEIGHT = 128;
const DEFAULT_MAGNIFICATION = 80;
const DEFAULT_DISTANCE = 150;
const DEFAULT_PANEL_HEIGHT = 64;

type DockOrientation = "horizontal" | "vertical";

type DockProps = {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  panelHeight?: number;
  magnification?: number;
  spring?: SpringOptions;
  orientation?: DockOrientation;
};
type DockItemProps = {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
};
type DockLabelProps = {
  className?: string;
  children: React.ReactNode;
};
type DockIconProps = {
  className?: string;
  children: React.ReactNode;
};

type DocContextType = {
  mouseX: MotionValue;
  spring: SpringOptions;
  magnification: number;
  distance: number;
  orientation: DockOrientation;
};
type DockProviderProps = {
  children: React.ReactNode;
  value: DocContextType;
};

const DockContext = createContext<DocContextType | undefined>(undefined);

function DockProvider({ children, value }: DockProviderProps) {
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

function useDock() {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error("useDock must be used within an DockProvider");
  }
  return context;
}

function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
  orientation = "horizontal",
}: DockProps) {
  // In vertical mode this motion value carries the mouse Y instead.
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const maxSize = useMemo(() => {
    return Math.max(DOCK_HEIGHT, magnification + magnification / 2 + 4);
  }, [magnification]);

  const sizeRow = useTransform(isHovered, [0, 1], [panelHeight, maxSize]);
  const size = useSpring(sizeRow, spring);

  if (orientation === "vertical") {
    return (
      <motion.div
        style={{ width: size, scrollbarWidth: "none" }}
        className="my-2 flex max-h-full items-start overflow-y-auto"
      >
        <motion.div
          onMouseMove={({ pageY }) => {
            isHovered.set(1);
            mouseX.set(pageY);
          }}
          onMouseLeave={() => {
            isHovered.set(0);
            mouseX.set(Infinity);
          }}
          className={cn("my-auto flex h-fit flex-col gap-4 rounded-2xl bg-gray-50 py-4", className)}
          style={{ width: panelHeight }}
          role="toolbar"
          aria-label="Application dock"
        >
          <DockProvider value={{ mouseX, spring, distance, magnification, orientation }}>
            {children}
          </DockProvider>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      style={{ height: size, scrollbarWidth: "none" }}
      className="mx-2 flex max-w-full items-end overflow-x-auto"
    >
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1);
          mouseX.set(pageX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={cn("mx-auto flex w-fit gap-4 rounded-2xl bg-gray-50 px-4", className)}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Application dock"
      >
        <DockProvider value={{ mouseX, spring, distance, magnification, orientation }}>
          {children}
        </DockProvider>
      </motion.div>
    </motion.div>
  );
}

function DockItem({ children, className, onClick, ariaLabel }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { distance, magnification, mouseX, spring, orientation } = useDock();

  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val) => {
    const domRect = ref.current?.getBoundingClientRect() ?? { x: 0, y: 0, width: 0, height: 0 };
    return orientation === "vertical"
      ? val - domRect.y - domRect.height / 2
      : val - domRect.x - domRect.width / 2;
  });

  const widthTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [40, magnification, 40]
  );

  const width = useSpring(widthTransform, spring);

  return (
    <motion.div
      ref={ref}
      style={orientation === "vertical" ? { height: width, width: "auto" } : { width }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn("relative inline-flex items-center justify-center", onClick && "cursor-pointer", className)}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      aria-haspopup="true"
    >
      {Children.map(children, (child) =>
        cloneElement(child as React.ReactElement<Record<string, unknown>>, { width, isHovered })
      )}
    </motion.div>
  );
}

function DockLabel({ children, className, ...rest }: DockLabelProps) {
  const restProps = rest as Record<string, unknown>;
  const isHovered = restProps["isHovered"] as MotionValue<number>;
  const { orientation } = useDock();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = isHovered.on("change", (latest) => {
      setIsVisible(latest === 1);
    });

    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={orientation === "vertical" ? { opacity: 0, x: 0 } : { opacity: 0, y: 0 }}
          animate={orientation === "vertical" ? { opacity: 1, x: 10 } : { opacity: 1, y: -10 }}
          exit={orientation === "vertical" ? { opacity: 0, x: 0 } : { opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute w-fit whitespace-pre rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-neutral-700",
            orientation === "vertical" ? "left-full top-1/2" : "-top-6 left-1/2",
            className
          )}
          role="tooltip"
          style={orientation === "vertical" ? { y: "-50%" } : { x: "-50%" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className, ...rest }: DockIconProps) {
  const restProps = rest as Record<string, unknown>;
  const width = restProps["width"] as MotionValue<number>;

  const widthTransform = useTransform(width, (val) => val / 2);

  return (
    <motion.div
      style={{ width: widthTransform }}
      className={cn("flex items-center justify-center", className)}
    >
      {children}
    </motion.div>
  );
}

export { Dock, DockIcon, DockItem, DockLabel };
