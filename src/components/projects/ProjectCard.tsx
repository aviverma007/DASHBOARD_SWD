import { fArea } from "../../utils/smartworldLogic";

export interface ProjectCardData {
  projectIndex: number;
  name: string;
  total: number;
  available: number;
  booked: number;
  management: number;
  areaAvail: number;
  areaBk: number;
  towers: string[];
  configs: string[];
  floorMin: number;
  floorMax: number;
}

interface ProjectCardProps {
  project: ProjectCardData;
  onClick: (project: ProjectCardData) => void;
}

const ACCENT_COLORS = [
  "#3c6db0",
  "#2e7d6f",
  "#b8893c",
  "#c2674a",
  "#7a5c84",
  "#4b7b3f",
];

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const { name, total, available, booked, management, areaAvail, towers, configs, floorMax, projectIndex } = project;
  const accent = ACCENT_COLORS[projectIndex % ACCENT_COLORS.length];
  const availPct = pct(available, total);
  const bookedPct = pct(booked, total);
  const t = total || 1;

  return (
    <div
      className="card"
      style={{ borderTopWidth: 3, borderTopColor: accent, cursor: "pointer" }}
      onClick={() => onClick(project)}
    >
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--ink)",
            lineHeight: 1.3,
            marginBottom: 4,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--mut)" }}>
          {towers.length} tower{towers.length !== 1 ? "s" : ""} ·{" "}
          {floorMax > 0 ? `${Math.round(floorMax)} floors` : "ground level"} ·{" "}
          {configs.join(", ")}
        </div>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 2 }}>Available</div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--av-text)",
              lineHeight: 1,
            }}
          >
            {available.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>{availPct}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 2 }}>Booked</div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--bk)",
              lineHeight: 1,
            }}
          >
            {booked.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>{bookedPct}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 2 }}>Total</div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1,
            }}
          >
            {total.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>units</div>
        </div>
      </div>

      {/* Absorption bar */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--mut)",
            marginBottom: 5,
          }}
        >
          <span>Absorption</span>
          <span>{bookedPct}% booked</span>
        </div>
        <div className="track">
          <div className="a" style={{ width: `${(available / t) * 100}%` }} />
          <div className="b" style={{ width: `${(booked / t) * 100}%` }} />
          <div className="k3" style={{ width: `${(management / t) * 100}%` }} />
        </div>
      </div>

      {/* Area row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--mut)",
          borderTop: "1px solid var(--line)",
          paddingTop: 10,
          marginTop: 4,
        }}
      >
        <span>
          <span style={{ color: "var(--av-text)", fontWeight: 600 }}>{fArea(areaAvail)}</span> available
        </span>
        <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>
          Click for stack plan ›
        </span>
      </div>

      {management > 0 && (
        <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 6 }}>
          {management} blocked unit{management !== 1 ? "s" : ""} excluded from total
        </div>
      )}
    </div>
  );
}
