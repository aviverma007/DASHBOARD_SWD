import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./features/authentication/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { InventoryOverviewPage } from "./features/inventory/InventoryOverviewPage";
import { SmartworldInventoryPage } from "./features/inventory/SmartworldInventoryPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { TargetActualPage } from "./features/target/TargetActualPage";
import { ChannelPartnerPage } from "./features/channelpartner/ChannelPartnerPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ChangePasswordPage } from "./features/settings/ChangePasswordPage";
import { ComingSoon } from "./components/common/ComingSoon";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<InventoryOverviewPage />} />
          <Route path="/inventory" element={<SmartworldInventoryPage />} />
          <Route path="/target" element={<TargetActualPage />} />
          <Route path="/channel-partners" element={<ChannelPartnerPage />} />
          <Route path="/sales" element={<ComingSoon moduleName="Sales" />} />
          <Route path="/collections" element={<ComingSoon moduleName="Collections" />} />
          <Route path="/revenue" element={<ComingSoon moduleName="Revenue" />} />
          <Route path="/customers" element={<ComingSoon moduleName="Customers" />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
