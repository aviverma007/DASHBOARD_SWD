import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "./features/authentication/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { useAuthStore } from "./store/authStore";
import { canAccess } from "./config/users";
import { HomePage } from "./features/home/HomePage";
import { Dual, MobileOnly, MHome, MAnalytics, MProjects, MMore, MReports, MSettings, MBookings, MInventory, MCollections, MCost, MChannel, MEoi, MTarget, MDigital, MFootfall, MCases } from "./mobile/routes";

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
  eoi: () => import("./features/eoi/EoiPage"),
  cases: () => import("./features/cases/CaseManagementPage"),
  cost: () => import("./features/cost/CostPage"),
  pr2po: () => import("./features/pr2po/PrToPoPage"),
  tracker: () => import("./features/tracker/ProjectTrackerPage"),
  loans: () => import("./features/loans/LoanDetailsPage"),
  collections: () => import("./features/collections/CollectionPage"),
  sapcollections: () => import("./features/sapcollections/SapCollectionsPage"),
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
const EoiPage = lazy(() => load.eoi().then(m => ({ default: m.EoiPage })));
const CaseManagementPage = lazy(load.cases);
const CostPage = lazy(load.cost);
const PrToPoPage = lazy(load.pr2po);
const ProjectTrackerPage = lazy(load.tracker);
const LoanDetailsPage = lazy(load.loans);
const CollectionPage = lazy(load.collections);
const SapCollectionsPage = lazy(() => load.sapcollections().then(m => ({ default: m.SapCollectionsPage })));
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
          <Route path="/" element={<Dual mobile={MHome} desktop={<HomePage />} />} />
          <Route path="/m/analytics" element={<MobileOnly mobile={MAnalytics} />} />
          <Route path="/m/projects" element={<MobileOnly mobile={MProjects} />} />
          <Route path="/m/more" element={<MobileOnly mobile={MMore} />} />
          <Route path="/overview" element={<RequireAccess path="/overview"><InventoryOverviewPage /></RequireAccess>} />
          <Route path="/inventory" element={<RequireAccess path="/inventory"><Dual mobile={MInventory} desktop={<SmartworldInventoryPage />} /></RequireAccess>} />
          <Route path="/target" element={<RequireAccess path="/target"><Dual mobile={MTarget} desktop={<TargetActualPage />} /></RequireAccess>} />
          <Route path="/channel-partners" element={<RequireAccess path="/channel-partners"><Dual mobile={MChannel} desktop={<ChannelPartnerPage />} /></RequireAccess>} />
          <Route path="/bookings" element={<RequireAccess path="/bookings"><Dual mobile={MBookings} desktop={<BookingsPage />} /></RequireAccess>} />
          <Route path="/eoi" element={<RequireAccess path="/eoi"><Dual mobile={MEoi} desktop={<EoiPage />} /></RequireAccess>} />
          <Route path="/cost" element={<RequireAccess path="/cost"><Dual mobile={MCost} desktop={<CostPage />} /></RequireAccess>} />
          <Route path="/pr-to-po" element={<RequireAccess path="/pr-to-po"><PrToPoPage /></RequireAccess>} />
          <Route path="/case-management" element={<RequireAccess path="/case-management"><Dual mobile={MCases} desktop={<CaseManagementPage />} /></RequireAccess>} />
          <Route path="/loan-details" element={<RequireAccess path="/loan-details"><LoanDetailsPage /></RequireAccess>} />
          <Route path="/collections" element={<RequireAccess path="/collections"><CollectionPage /></RequireAccess>} />
          <Route path="/sap-collections" element={<RequireAccess path="/sap-collections"><Dual mobile={MCollections} desktop={<SapCollectionsPage />} /></RequireAccess>} />
          <Route path="/gallery-footfall" element={<RequireAccess path="/gallery-footfall"><Dual mobile={MFootfall} desktop={<LeadConversionPage mode="footfall" />} /></RequireAccess>} />
          <Route path="/digital-leads" element={<RequireAccess path="/digital-leads"><Dual mobile={MDigital} desktop={<LeadConversionPage mode="digital" />} /></RequireAccess>} />
          <Route path="/lead-conversion" element={<RequireAccess path="/lead-conversion"><LeadConversionPage mode="footfall" /></RequireAccess>} />
          <Route path="/projects" element={<RequireAccess path="/projects"><ProjectsPage /></RequireAccess>} />
          <Route path="/project-tracker" element={<RequireAccess path="/project-tracker"><ProjectTrackerPage /></RequireAccess>} />
          <Route path="/reports" element={<RequireAccess path="/reports"><Dual mobile={MReports} desktop={<ReportsPage />} /></RequireAccess>} />
          <Route path="/notes" element={<RequireAccess path="/notes"><NotesPage /></RequireAccess>} />
          <Route path="/guide" element={<RequireAccess path="/guide"><GuidePage /></RequireAccess>} />
          <Route path="/settings" element={<Dual mobile={MSettings} desktop={<SettingsPage />} />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
