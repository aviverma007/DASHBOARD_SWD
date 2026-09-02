import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./features/authentication/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { HomePage } from "./features/home/HomePage";

/* Route-level code splitting: each heavy page (and its dataset JSON)
 * downloads only when first visited, instead of one ~5.6 MB chunk on
 * login. Named-export modules are mapped to default for lazy(). */
const InventoryOverviewPage = lazy(() => import("./features/inventory/InventoryOverviewPage").then(m => ({ default: m.InventoryOverviewPage })));
const SmartworldInventoryPage = lazy(() => import("./features/inventory/SmartworldInventoryPage").then(m => ({ default: m.SmartworldInventoryPage })));
const ProjectsPage = lazy(() => import("./features/projects/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const ReportsPage = lazy(() => import("./features/reports/ReportsPage").then(m => ({ default: m.ReportsPage })));
const TargetActualPage = lazy(() => import("./features/target/TargetActualPage").then(m => ({ default: m.TargetActualPage })));
const ChannelPartnerPage = lazy(() => import("./features/channelpartner/ChannelPartnerPage").then(m => ({ default: m.ChannelPartnerPage })));
const LeadConversionPage = lazy(() => import("./features/leads/LeadConversionPage").then(m => ({ default: m.LeadConversionPage })));
const BookingsPage = lazy(() => import("./features/bookings/BookingsPage").then(m => ({ default: m.BookingsPage })));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const ChangePasswordPage = lazy(() => import("./features/settings/ChangePasswordPage").then(m => ({ default: m.ChangePasswordPage })));
const NotesPage = lazy(() => import("./features/workspace/NotesPage").then(m => ({ default: m.NotesPage })));
const GuidePage = lazy(() => import("./features/workspace/GuidePage").then(m => ({ default: m.GuidePage })));

const Fallback = (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#8a94a6", fontSize: 14, fontFamily: "inherit" }}>
    Loading…
  </div>
);

function App() {
  return (
    <BrowserRouter>
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
