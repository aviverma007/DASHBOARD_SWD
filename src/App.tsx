import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "./features/authentication/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { useAuthStore } from "./store/authStore";
import { canAccess } from "./config/users";
import { HomePage } from "./features/home/HomePage";

/* Route-level code splitting: each heavy page (and its dataset JSON)
 * downloads only when first visited, instead of one ~5.6 MB chunk on
 * login. Named-export modules are mapped to default for lazy(). */
const load = {
  overview: () => import("./features/inventory/InventoryOverviewPage"),
  inventory: () => import("./features/inventory/SmartworldInventoryPage"),
  projects: () => import("./features/projects/ProjectsPage"),
  reports: () => import("./features/reports/ReportsPage"),
  target: () => import("./features/target/TargetActualPage"),
  cp: () => import("./features/channelpartner/ChannelPartnerPage"),
  leads: () => import("./features/leads/LeadConversionPage"),
  bookings: () => import("./features/bookings/BookingsPage"),
  cases: () => import("./features/cases/CaseManagementPage"),
  settings: () => import("./features/settings/SettingsPage"),
  changePw: () => import("./features/settings/ChangePasswordPage"),
  notes: () => import("./features/workspace/NotesPage"),
  guide: () => import("./features/workspace/GuidePage"),
};
const InventoryOverviewPage = lazy(() => load.overview().then(m => ({ default: m.InventoryOverviewPage })));
const SmartworldInventoryPage = lazy(() => load.inventory().then(m => ({ default: m.SmartworldInventoryPage })));
const ProjectsPage = lazy(() => load.projects().then(m => ({ default: m.ProjectsPage })));
const ReportsPage = lazy(() => load.reports().then(m => ({ default: m.ReportsPage })));
const TargetActualPage = lazy(() => load.target().then(m => ({ default: m.TargetActualPage })));
const ChannelPartnerPage = lazy(() => load.cp().then(m => ({ default: m.ChannelPartnerPage })));
const LeadConversionPage = lazy(() => load.leads().then(m => ({ default: m.LeadConversionPage })));
const BookingsPage = lazy(() => load.bookings().then(m => ({ default: m.BookingsPage })));
const CaseManagementPage = lazy(load.cases);
const SettingsPage = lazy(() => load.settings().then(m => ({ default: m.SettingsPage })));
const ChangePasswordPage = lazy(() => load.changePw().then(m => ({ default: m.ChangePasswordPage })));
const NotesPage = lazy(() => load.notes().then(m => ({ default: m.NotesPage })));
const GuidePage = lazy(() => load.guide().then(m => ({ default: m.GuidePage })));

/** Warm every page chunk in the background right after first paint:
 * login stays light (small initial bundle) but by the time anyone
 * clicks a tab its code is already cached — navigation is instant,
 * no loading screen. Router v7 wraps navigations in startTransition,
 * so even a cold click keeps the current page visible instead of a
 * fallback flash (fallback below is null for exactly that reason —
 * it only ever applies to a hard refresh mid-route). */

function RequireAccess({ path, children }: { path: string; children: React.ReactElement }) {
  const access = useAuthStore((s) => s.access);
  if (!canAccess(access, path)) return <Navigate to="/" replace />;
  return children;
}
function PrefetchAll() {
  useEffect(() => {
    const t = window.setTimeout(() => { Object.values(load).forEach(fn => { fn().catch(() => {}); }); }, 300);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

const Fallback = null;

function App() {
  return (
    <BrowserRouter>
      <PrefetchAll />
      <Suspense fallback={Fallback}>
      <Routes>
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<HomePage />} />
          <Route path="/overview" element={<RequireAccess path="/overview"><InventoryOverviewPage /></RequireAccess>} />
          <Route path="/inventory" element={<RequireAccess path="/inventory"><SmartworldInventoryPage /></RequireAccess>} />
          <Route path="/target" element={<RequireAccess path="/target"><TargetActualPage /></RequireAccess>} />
          <Route path="/channel-partners" element={<RequireAccess path="/channel-partners"><ChannelPartnerPage /></RequireAccess>} />
          <Route path="/bookings" element={<RequireAccess path="/bookings"><BookingsPage /></RequireAccess>} />
          <Route path="/case-management" element={<RequireAccess path="/case-management"><CaseManagementPage /></RequireAccess>} />
          <Route path="/gallery-footfall" element={<RequireAccess path="/gallery-footfall"><LeadConversionPage mode="footfall" /></RequireAccess>} />
          <Route path="/digital-leads" element={<RequireAccess path="/digital-leads"><LeadConversionPage mode="digital" /></RequireAccess>} />
          <Route path="/lead-conversion" element={<RequireAccess path="/lead-conversion"><LeadConversionPage mode="footfall" /></RequireAccess>} />
          <Route path="/projects" element={<RequireAccess path="/projects"><ProjectsPage /></RequireAccess>} />
          <Route path="/reports" element={<RequireAccess path="/reports"><ReportsPage /></RequireAccess>} />
          <Route path="/notes" element={<RequireAccess path="/notes"><NotesPage /></RequireAccess>} />
          <Route path="/guide" element={<RequireAccess path="/guide"><GuidePage /></RequireAccess>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
