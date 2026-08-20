import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./features/authentication/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { InventoryOverviewPage } from "./features/inventory/InventoryOverviewPage";
import { SmartworldInventoryPage } from "./features/inventory/SmartworldInventoryPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ChangePasswordPage } from "./features/settings/ChangePasswordPage";
import { ComingSoon } from "./components/common/ComingSoon";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Change password: public route, opens in new tab from Settings */}
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<InventoryOverviewPage />} />
          <Route path="/inventory" element={<SmartworldInventoryPage />} />
          <Route path="/sales" element={<ComingSoon moduleName="Sales" />} />
          <Route path="/collections" element={<ComingSoon moduleName="Collections" />} />
          <Route path="/revenue" element={<ComingSoon moduleName="Revenue" />} />
          <Route path="/customers" element={<ComingSoon moduleName="Customers" />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/reports" element={<ComingSoon moduleName="Reports" />} />
          <Route path="/upload" element={<ComingSoon moduleName="Data Upload" />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
