import { useMemo, useState } from "react";
import { calcOverall, PDRN } from "../../utils/pdrnLogic";
import type { PeriodFilter, ProjectStats } from "../../utils/pdrnLogic";
import { KpiTable } from "../../components/overview/KpiTable";
import { PdrnFilters } from "../../components/overview/PdrnFilters";
import { PdrnDrawer } from "../../components/overview/PdrnDrawer";
import "../../components/inventory/smartworldInventory.css";

const ACCENT_COLORS = ["#3c6db0","#2e7d6f","#b8893c","#c2674a","#7a5c84","#4b7b3f"];

const DEFAULT_PERIOD: PeriodFilter = { type: "all" };

export function InventoryOverviewPage() {
  const [selectedProject, setSelectedProject] = useState<"all" | string>("all");
  const [period, setPeriod] = useState<PeriodFilter>(DEFAULT_PERIOD);
  const [drawerProject, setDrawerProject] = useState<ProjectStats | null>(null);

  const overall = useMemo(() => calcOverall(period), [period]);

  // Which projects to show in the grid — all 6 INVR projects, filtered if one is selected
  const visibleProjects = useMemo(() => {
    if (selectedProject === "all") return overall.projects;
    return overall.projects.filter((p) => p.projectName === selectedProject);
  }, [overall.projects, selectedProject]);

  function handleReset() {
    setSelectedProject("all");
    setPeriod(DEFAULT_PERIOD);
    setDrawerProject(null);
  }

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Filter bar */}
      <PdrnFilters
        projects={PDRN.P}
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
        period={period}
        onPeriodChange={setPeriod}
        years={PDRN.meta.years}
        onReset={handleReset}
      />

      <div className="wrap">
        {/* OVERALL card — always visible */}
        {selectedProject === "all" && (
          <div style={{ marginBottom: 20 }}>
            <KpiTable
              stats={overall}
              label="BUSINESS OVERVIEW"
              accent="var(--blue)"
            />
          </div>
        )}

        {/* Project cards grid — 3 columns, one per project */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {visibleProjects.map((proj) => (
            <KpiTable
              key={proj.invProjIdx}
              stats={proj}
              label={proj.projectName}
              accent={ACCENT_COLORS[proj.invProjIdx % ACCENT_COLORS.length]}
              onClick={() => setDrawerProject(proj)}
              isProject
            />
          ))}
        </div>
      </div>

      {/* Drill-down drawer */}
      {drawerProject && (
        <PdrnDrawer
          invProjIdx={drawerProject.invProjIdx}
          projectName={drawerProject.projectName}
          period={period}
          onClose={() => setDrawerProject(null)}
          unsoldUnits={drawerProject.unsold.units}
          unsoldArea={drawerProject.unsold.area}
        />
      )}
    </div>
  );
}
