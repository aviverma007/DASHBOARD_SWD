import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./features/authentication/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
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
          <Route path="/overview" element={<InventoryOverviewPage />} />
          <Route path="/inventory" element={<SmartworldInventoryPage />} />
          <Route path="/target" element={<TargetActualPage />} />
          <Route path="/channel-partners" element={<ChannelPartnerPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/gallery-footfall" element={<LeadConversionPage mode="footfall" />} />
          <Route path="/digital-leads" element={<LeadConversionPage mode="digital" />} />
          <Route path="/lead-conversion" element={<LeadConversionPage mode="footfall" />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
