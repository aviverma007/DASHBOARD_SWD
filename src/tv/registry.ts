import type { TvDept, TvDeptDef } from "./types";
import { sales } from "./depts/sales";
import { targets } from "./depts/targets";
import { partners } from "./depts/partners";
import { marketing } from "./depts/marketing";
import { projects } from "./depts/projects";
import { finance } from "./depts/finance";
import { procurement } from "./depts/procurement";
import { cp } from "./depts/cp";
import { care } from "./depts/care";

export const DEPTS: TvDeptDef[] = [sales, targets, partners, marketing, projects, finance, procurement, cp, care];

/** headline KPI shown per department in the Executive show */
const HEADLINE: Record<string, string> = {
  sales: "tsv", targets: "ach", partners: "tsv", marketing: "visits", projects: "avail",
  finance: "coll", procurement: "total", cp: "util", care: "open",
};

/** Executive show = one headline KPI + its story from every department. */
async function loadExec(): Promise<TvDept> {
  const res = await Promise.allSettled(DEPTS.map(d => d.load()));
  const kpis: TvDept["kpis"] = [], stories: TvDept["stories"] = [];
  res.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const d = r.value, id = DEPTS[i].id;
    const k = d.kpis.find(x => x.id === HEADLINE[id]) ?? d.kpis[0];
    if (!k) return;
    const nk = { ...k, id: `${id}.${k.id}`, label: `${DEPTS[i].name.split(" — ")[0]} · ${k.label}` };
    const st = d.stories.find(s => s.focus === k.id) ?? d.stories[0];
    kpis.push(nk);
    if (st) stories.push({ ...st, focus: nk.id });
  });
  if (!kpis.length) throw new Error("No department data could be loaded");
  return { id: "exec", name: "Executive Overview", tagline: "One headline from every department", asOn: "latest data from every department", live: false, kpis, stories };
}

export const EXEC: TvDeptDef = {
  id: "exec", name: "Executive Overview", tagline: "One headline from every department", pages: "All departments · the boss view",
  icon: "LayoutDashboard", tone: "gold", load: loadExec,
};
export const ALL_DEFS: TvDeptDef[] = [EXEC, ...DEPTS];
