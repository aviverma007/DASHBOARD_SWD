/** Mobile screen registry + the Dual switch used by App routes. */
import { lazy, type ComponentType, type ReactElement } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "./useIsMobile";

export const MHome = lazy(() => import("./screens/Home"));
export const MAnalytics = lazy(() => import("./screens/Hubs").then(m => ({ default: m.AnalyticsHub })));
export const MProjects = lazy(() => import("./screens/Hubs").then(m => ({ default: m.ProjectsHub })));
export const MMore = lazy(() => import("./screens/More"));
export const MReports = lazy(() => import("./screens/Reports"));
export const MSettings = lazy(() => import("./screens/Settings"));

/** paths that have a purpose-built phone screen (everything else shows the desktop page inside the phone shell) */
export const MBookings = lazy(() => import("./screens/Bookings"));
export const MInventory = lazy(() => import("./screens/Inventory"));
export const MCollections = lazy(() => import("./screens/Collections"));
export const MCost = lazy(() => import("./screens/Cost"));
export const MChannel = lazy(() => import("./screens/ChannelPartners"));
export const MEoi = lazy(() => import("./screens/Eoi"));
export const MTarget = lazy(() => import("./screens/Target"));
export const MDigital = lazy(() => import("./screens/Digital"));
export const MFootfall = lazy(() => import("./screens/Footfall"));
export const MCases = lazy(() => import("./screens/Cases"));
export const MCollection = lazy(() => import("./screens/CollectionLive"));
export const MLoans = lazy(() => import("./screens/Loans"));
export const MPrToPo = lazy(() => import("./screens/PrToPo"));
export const MTracker = lazy(() => import("./screens/Tracker"));
export const MStack = lazy(() => import("./screens/StackPlans"));
export const MOverview = lazy(() => import("./screens/Overview"));
export const MNotes = lazy(() => import("./screens/Notes"));
export const MGuide = lazy(() => import("./screens/Guide"));
export const MOBILE_SCREENS = new Set<string>(["/", "/m/analytics", "/m/projects", "/m/more", "/reports", "/settings", "/collections", "/loan-details", "/pr-to-po", "/project-tracker", "/projects", "/overview", "/notes", "/guide", "/bookings", "/inventory", "/sap-collections", "/cost", "/channel-partners", "/eoi", "/target", "/digital-leads", "/gallery-footfall", "/case-management"]);
/** …and the ones that have no desktop twin to open as "full view" */
export const NO_FULL = new Set<string>(["/", "/m/analytics", "/m/projects", "/m/more", "/settings"]);

export function Dual({ mobile: M, desktop }: { mobile: ComponentType; desktop: ReactElement }) {
  const isMobile = useIsMobile();
  const [sp] = useSearchParams();
  if (!isMobile || sp.get("view") === "full") return desktop;
  return <M />;
}
/** phone-only hub routes: desktop users never see them */
export function MobileOnly({ mobile: M }: { mobile: ComponentType }) {
  return useIsMobile() ? <M /> : <Navigate to="/" replace />;
}
