import { useMemo, useState } from "react";
import rawData from "../../data/smartworldInventory.json";
import type { RawInventoryDataset, RawUnit } from "../../types/smartworldRaw";
import { ProjectCard } from "../../components/projects/ProjectCard";
import type { ProjectCardData } from "../../components/projects/ProjectCard";
import { ProjectDrawer } from "../../components/projects/ProjectDrawer";
import "../../components/inventory/smartworldInventory.css";

const RD = rawData as unknown as RawInventoryDataset;

interface ProjectRawUnit {
  projectIndex: number;
  towerIndex: number;
  floorNumber: number;
  floorLabel: string;
  configName: string;
  area: number;
  status: 0 | 1 | 2;
  unitLabel: string;
}

export function ProjectsPage() {
  const [selected, setSelected] = useState<ProjectCardData | null>(null);

  const { projects, unitsByProject } = useMemo(() => {
    const projects: ProjectCardData[] = RD.P.map((name, projectIndex) => {
      const units = RD.U.filter((u: RawUnit) => u[0] === projectIndex);
      const av = units.filter((u) => u[8] === 0).length;
      const bk = units.filter((u) => u[8] === 1).length;
      const bl = units.filter((u) => u[8] === 2).length;
      const areaAvail = units.filter((u) => u[8] === 0).reduce((s, u) => s + u[6], 0);
      const areaBk = units.filter((u) => u[8] === 1).reduce((s, u) => s + u[6], 0);
      const towers = [...new Set(units.map((u) => RD.TW[u[1]]).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
      const configs = [...new Set(units.map((u) => RD.CFG[u[4]]))].sort();
      const floorNums = units.map((u) => u[2]);
      return {
        projectIndex,
        name,
        total: units.length,
        available: av,
        booked: bk,
        management: bl,
        areaAvail,
        areaBk,
        towers,
        configs,
        floorMin: Math.min(...floorNums),
        floorMax: Math.max(...floorNums),
      };
    });

    const unitsByProject = new Map<number, ProjectRawUnit[]>();
    RD.U.forEach((u: RawUnit) => {
      const list = unitsByProject.get(u[0]) ?? [];
      list.push({
        projectIndex: u[0],
        towerIndex: u[1],
        floorNumber: u[2],
        floorLabel: RD.FL[u[3]] ?? `Floor ${u[2]}`,
        configName: RD.CFG[u[4]],
        area: u[6],
        status: u[8],
        unitLabel: u[12],
      });
      unitsByProject.set(u[0], list);
    });

    return { projects, unitsByProject };
  }, []);

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Page header — matches Inventory's own navy header style */}
      <div
        style={{
          background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)",
          padding: "18px 24px 20px",
          borderBottom: "3px solid var(--gold)",
        }}
      >
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 20,
            color: "#fff",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Projects
        </div>
        <div style={{ fontSize: 12.5, color: "#a9b2c7" }}>
          {RD.P.length} projects · {RD.U.length.toLocaleString("en-IN")} total units · click a
          project to see its stack plan
        </div>
      </div>

      <div className="wrap">
        {/* Summary strip */}
        <div className="kpis" style={{ marginBottom: 20 }}>
          {[
            {
              k: "Projects",
              v: RD.P.length.toString(),
              s: "live in portfolio",
              color: "var(--blue)",
            },
            {
              k: "Total units",
              v: RD.U.length.toLocaleString("en-IN"),
              s: "across all projects",
              color: "var(--ink)",
            },
            {
              k: "Available",
              v: RD.U.filter((u) => u[8] === 0).length.toLocaleString("en-IN"),
              s: `${Math.round((RD.U.filter((u) => u[8] === 0).length / RD.U.length) * 100)}% of stock`,
              color: "var(--av-text)",
            },
            {
              k: "Booked",
              v: RD.U.filter((u) => u[8] === 1).length.toLocaleString("en-IN"),
              s: `${Math.round((RD.U.filter((u) => u[8] === 1).length / RD.U.length) * 100)}% absorbed`,
              color: "var(--bk)",
            },
          ].map((item) => (
            <div
              key={item.k}
              className="kpi"
              style={{
                borderTopColor: item.color,
                borderTopWidth: 3,
                cursor: "default",
              }}
            >
              <div className="k">{item.k}</div>
              <div className="v" style={{ color: item.color }}>
                {item.v}
              </div>
              <div className="s">{item.s}</div>
            </div>
          ))}
        </div>

        {/* Project cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {projects.map((project) => (
            <ProjectCard key={project.projectIndex} project={project} onClick={setSelected} />
          ))}
        </div>
      </div>

      {/* Stack plan drawer */}
      {selected && (
        <ProjectDrawer
          project={selected}
          units={unitsByProject.get(selected.projectIndex) ?? []}
          towerNames={RD.TW}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
