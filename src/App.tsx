import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./features/authentication/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { InventoryOverviewPage } from "./features/inventory/InventoryOverviewPage";
import { SmartworldInventoryPage } from "./features/inventory/SmartworldInventoryPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { TargetActualPage } from "./features/target/TargetActualPage";
import { ChannelPartnerPage } from "./features/channelpartner/ChannelPartnerPage";
import { LeadConversionPage } from "./features/leads/LeadConversionPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ChangePasswordPage } from "./features/settings/ChangePasswordPage";
import { HomePage } from "./features/home/HomePage";
import { NotesPage } from "./features/workspace/NotesPage";
import { GuidePage } from "./features/workspace/GuidePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<HomePage />} />
          <Route path="/overview" element={<InventoryOverviewPage />} />
          <Route path="/inventory" element={<SmartworldInventoryPage />} />
          <Route path="/target" element={<TargetActualPage />} />
          <Route path="/channel-partners" element={<ChannelPartnerPage />} />
          <Route path="/lead-conversion" element={<LeadConversionPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
