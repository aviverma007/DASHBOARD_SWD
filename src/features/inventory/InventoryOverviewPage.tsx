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
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set()); // empty = All
  const [period, setPeriod] = useState<PeriodFilter>(DEFAULT_PERIOD);
  const [drawerProject, setDrawerProject] = useState<ProjectStats | null>(null);

  const overall = useMemo(() => calcOverall(period), [period]);

  const visibleProjects = useMemo(() => {
    if (selectedProjects.size === 0) return overall.projects;
    return overall.projects.filter(p => selectedProjects.has(p.projectName));
  }, [overall.projects, selectedProjects]);

  // Filtered overall: sum of visible projects only
  const visibleOverall = useMemo(() => {
    if (selectedProjects.size === 0) return overall;
    const projs = visibleProjects;
    const sold   = { units: projs.reduce((s,p)=>s+p.sold.units,0),   area: projs.reduce((s,p)=>s+p.sold.area,0),   tsv: projs.reduce((s,p)=>s+p.sold.tsv,0) };
    const unsold = { units: projs.reduce((s,p)=>s+p.unsold.units,0), area: projs.reduce((s,p)=>s+p.unsold.area,0) };
    const total  = { units: sold.units+unsold.units, area: sold.area+unsold.area };
    const soldPct = total.units ? Math.round(sold.units/total.units*100) : 0;
    return { sold, unsold, total, soldPct, management: 0, projects: projs };
  }, [overall, selectedProjects, visibleProjects]);

  function handleReset() {
    setSelectedProjects(new Set());
    setPeriod(DEFAULT_PERIOD);
    setDrawerProject(null);
  }

  // Layout: filter bar (fixed height) + overall card + N project cards
  // All must fit in one screen — use flex column with no-scroll container
  return (
    <div className="sw-inv" style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Filter bar */}
      <PdrnFilters
        projects={PDRN.P}
        selectedProjects={selectedProjects}
        onProjectsChange={setSelectedProjects}
        period={period}
        onPeriodChange={setPeriod}
        years={PDRN.meta.years}
        onReset={handleReset}
      />

      {/* Cards area — fills remaining height, no scroll */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "12px 20px 12px",
        gap: 8,
        overflow: "hidden",
        background: "var(--bg)",
      }}>
        {/* Overall card */}
        <KpiTable
          stats={visibleOverall}
          label={selectedProjects.size === 0 ? "BUSINESS OVERVIEW" : `Selected projects (${selectedProjects.size})`}
          accent="var(--blue)"
        />

        {/* Project cards — each takes equal remaining height */}
        {visibleProjects.map(proj => (
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
