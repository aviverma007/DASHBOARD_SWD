import { useMemo, useState } from "react";
import { calcOverall, PDRN } from "../../utils/pdrnLogic";
import type { PeriodFilter, ProjectStats } from "../../utils/pdrnLogic";
import { KpiTable } from "../../components/overview/KpiTable";
import { PdrnFilters } from "../../components/overview/PdrnFilters";
import { PdrnDrawer } from "../../components/overview/PdrnDrawer";
import "../../components/inventory/smartworldInventory.css";

const ACCENT_COLORS = ["#3c6db0","#2e7d6f","#b8893c","#c2674a","#7a5c84","#4b7b3f"];
const DEFAULT_PERIOD: PeriodFilter = { type: "all" };

/** Map INVR project name → site plan image path (served from /public/projects/) */
const PROJECT_IMAGES: Record<string, string> = {
  "SMARTWORLD THE EDITION":   "/projects/the_edition.png",
  "SMARTWORLD LE COURTYARD":  "/projects/le_courtyard.png",
  "SMARTWORLD RESIDENCIES":   "/projects/residencies.png",
  "SMARTWORLD SKY ARC":       "/projects/sky_arc.png",
  "SMARTWORLD SUITES":        "/projects/suites.png",
  "TRUMP RESIDENCES GURGAON": "/projects/trump.png",
};

export function InventoryOverviewPage() {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [drawerProject, setDrawerProject] = useState<ProjectStats | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = useState<string>("");

  const overall = useMemo(() => calcOverall(DEFAULT_PERIOD), []);

  const visibleProjects = useMemo(() => {
    if (selectedProjects.size === 0) return overall.projects;
    return overall.projects.filter(p => selectedProjects.has(p.projectName));
  }, [overall.projects, selectedProjects]);

  const visibleOverall = useMemo(() => {
    if (selectedProjects.size === 0) return overall;
    const projs = visibleProjects;
    const sold   = { units: projs.reduce((s,p)=>s+p.sold.units,0), area: projs.reduce((s,p)=>s+p.sold.area,0), tsv: projs.reduce((s,p)=>s+p.sold.tsv,0) };
    const unsold = { units: projs.reduce((s,p)=>s+p.unsold.units,0), area: projs.reduce((s,p)=>s+p.unsold.area,0) };
    const total  = { units: sold.units+unsold.units, area: sold.area+unsold.area };
    const soldPct = total.units ? Math.round(sold.units/total.units*100) : 0;
    // Same derivation as calcOverall(): blended avg from summed tsv/area,
    // highest/lowest from the extremes of the selected projects' own
    // extremes (equivalent to recomputing from every underlying record).
    const maxes = projs.map(p => p.rate.max).filter((v): v is number => v !== null);
    const mins  = projs.map(p => p.rate.min).filter((v): v is number => v !== null);
    const rate = {
      avg: sold.area > 0 ? sold.tsv / sold.area : null,
      max: maxes.length ? Math.max(...maxes) : null,
      min: mins.length ? Math.min(...mins) : null,
    };
    return { sold, unsold, total, soldPct, management: 0, projects: projs, rate };
  }, [overall, selectedProjects, visibleProjects]);

  function handleReset() {
    setSelectedProjects(new Set());
    setDrawerProject(null);
  }

  function openLightbox(src: string, label: string, e: React.MouseEvent) {
    e.stopPropagation();
    setLightboxSrc(src);
    setLightboxLabel(label);
  }

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 90% compact view on desktop, same pattern as Target vs Actual.
          The lightbox and drill drawer stay OUTSIDE this wrapper — CSS
          `zoom` creates a new containing block for position:fixed
          descendants, which would make them scroll with the page. */}
      <div className="tv-zoom-desktop" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <PdrnFilters
        projects={PDRN.P}
        selectedProjects={selectedProjects}
        onProjectsChange={setSelectedProjects}
        onReset={handleReset}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 20px 20px", gap: 8, background: "var(--bg)" }}>
        {/* Overall card — no image */}
        <KpiTable
          stats={visibleOverall}
          label={selectedProjects.size === 0 ? "BUSINESS OVERVIEW" : `Selected projects (${selectedProjects.size})`}
          accent="var(--blue)"
          isOverall
        />

        {/* Project rows: [thumbnail] [KPI card] */}
        {visibleProjects.map(proj => {
          const imgSrc = PROJECT_IMAGES[proj.projectName];
          return (
            <div key={proj.invProjIdx} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>

              {/* Site plan thumbnail */}
              {imgSrc && (
                <div
                  onClick={(e) => openLightbox(imgSrc, proj.projectName, e)}
                  title="View site plan"
                  style={{
                    flexShrink: 0,
                    width: 110,
                    borderRadius: 10,
                    overflow: "hidden",
                    cursor: "zoom-in",
                    border: "1px solid var(--line)",
                    position: "relative",
                    background: "#f4f2ec",
                  }}
                >
                  <img
                    src={imgSrc}
                    alt={`${proj.projectName} site plan`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(transparent, rgba(14,22,45,0.75))",
                    color: "#fff",
                    fontSize: 10,
                    padding: "12px 6px 5px",
                    textAlign: "center",
                    letterSpacing: "0.5px",
                  }}>
                    🔍 Site plan
                  </div>
                </div>
              )}

              {/* KPI card — fills remaining width */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <KpiTable
                  stats={proj}
                  label={proj.projectName}
                  accent={ACCENT_COLORS[proj.invProjIdx % ACCENT_COLORS.length]}
                  onClick={() => setDrawerProject(proj)}
                  isProject
                />
              </div>
            </div>
          );
        })}
      </div>
      </div>
      {/* end zoomed wrapper — lightbox + drawer below stay un-zoomed */}

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(8,13,28,0.93)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          {/* Header */}
          <div style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 24px", flexShrink: 0,
          }}>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 17, color: "#fff", fontWeight: 700 }}>
              {lightboxLabel}
              <span style={{ fontSize: 12, color: "#a9b2c7", fontFamily: "inherit", fontWeight: 400, marginLeft: 10 }}>
                Site plan
              </span>
            </div>
            <button
              onClick={() => setLightboxSrc(null)}
              style={{ background:"none", border:"none", color:"#c7cedf", fontSize:28, cursor:"pointer", lineHeight:1 }}
            >✕</button>
          </div>

          {/* Image */}
          <img
            src={lightboxSrc}
            alt="Site plan"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              objectFit: "contain",
              borderRadius: 10,
              boxShadow: "0 12px 80px rgba(0,0,0,0.8)",
              cursor: "default",
            }}
          />

          <div style={{ marginTop: 14, fontSize: 12, color: "#5a6478" }}>
            Click anywhere outside to close
          </div>
        </div>
      )}

      {drawerProject && (
        <PdrnDrawer
          invProjIdx={drawerProject.invProjIdx}
          projectName={drawerProject.projectName}
          period={DEFAULT_PERIOD}
          onClose={() => setDrawerProject(null)}
          unsoldUnits={drawerProject.unsold.units}
          unsoldArea={drawerProject.unsold.area}
        />
      )}
    </div>
  );
}
