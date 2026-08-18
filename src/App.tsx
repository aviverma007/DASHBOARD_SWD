import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./features/authentication/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { InventoryOverviewPage } from "./features/inventory/InventoryOverviewPage";
import { ComingSoon } from "./components/common/ComingSoon";

function App() {
  return (
    <BrowserRouter>
      <RequireAuth>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<InventoryOverviewPage />} />
            <Route path="/inventory" element={<InventoryOverviewPage />} />
            <Route path="/sales" element={<ComingSoon moduleName="Sales" />} />
            <Route path="/collections" element={<ComingSoon moduleName="Collections" />} />
            <Route path="/revenue" element={<ComingSoon moduleName="Revenue" />} />
            <Route path="/customers" element={<ComingSoon moduleName="Customers" />} />
            <Route path="/projects" element={<ComingSoon moduleName="Projects" />} />
            <Route path="/reports" element={<ComingSoon moduleName="Reports" />} />
            <Route path="/upload" element={<ComingSoon moduleName="Data Upload" />} />
            <Route path="/settings" element={<ComingSoon moduleName="Settings" />} />
          </Route>
        </Routes>
      </RequireAuth>
    </BrowserRouter>
  );
}

export default App;
