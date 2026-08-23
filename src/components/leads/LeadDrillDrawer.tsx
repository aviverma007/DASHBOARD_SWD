import { useMemo, useState } from "react";
import { FOOTFALL, CP_VISITS, DIGITAL, breakdownBy, monthLabel } from "../../utils/leadLogic";
import type { FootfallRecord, CpVisitRecord, DigitalRecord } from "../../utils/leadLogic";

export type LeadSource = "footfall" | "cpvisits" | "digital";

interface LeadDrillDrawerProps {
  source: LeadSource;
  title: string;
  filterFn: (r: FootfallRecord | CpVisitRecord | DigitalRecord) => boolean;
  onClose: () => void;
}

type AnyRecord = FootfallRecord | CpVisitRecord | DigitalRecord;

function Breadcrumbs({ path, onCrumb }: { path: string[]; onCrumb: (i: number) => void }) {
  return (
    <div className="crumbs">
      {path.map((label, i) => (
        <button key={i} className="crumb" onClick={() => onCrumb(i)}>
          {label}
          {i < path.length - 1 && <span className="c">›</span>}
        </button>
      ))}
    </div>
  );
}

export function LeadDrillDrawer({ source, title, filterFn, onClose }: LeadDrillDrawerProps) {
  const allRecords: AnyRecord[] = source === "footfall" ? FOOTFALL.records : source === "cpvisits" ? CP_VISITS.records : DIGITAL.records;
  const scoped = useMemo(() => allRecords.filter(filterFn), [allRecords, filterFn]);

  const [path, setPath] = useState<{ label: string; project?: string }[]>([{ label: title }]);
  const [selectedRecord, setSelectedRecord] = useState<AnyRecord | null>(null);
  const current = path[path.length - 1];

  function push(seg: { label: string; project?: string }) { setSelectedRecord(null); setPath(p => [...p, seg]); }
  function popTo(i: number) { setSelectedRecord(null); setPath(p => p.slice(0, i + 1)); }

  const projectScope = current.project ? scoped.filter(r => r.project === current.project) : scoped;

  const byProject = useMemo(() => breakdownBy(scoped, r => r.project, 20), [scoped]);

  const headTitle = selectedRecord
    ? (source === "footfall" ? (selectedRecord as FootfallRecord).name || "Record"
       : source === "cpvisits" ? (selectedRecord as CpVisitRecord).name || "Record"
       : (selectedRecord as DigitalRecord).project)
    : current.label;

  return (
    <>
      <div id="ov" className="open" onClick={() => { setSelectedRecord(null); onClose(); }} />
      <div id="dw" className="open">
        <div className="dwh">
          <button className="x" onClick={() => { setSelectedRecord(null); onClose(); }}>✕</button>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 17 }}>{headTitle}</div>
          <Breadcrumbs path={path.map(p => p.label)} onCrumb={i => { setSelectedRecord(null); popTo(i); }} />
        </div>

        <div className="dwb">
          {selectedRecord ? (
            <>
              <button className="back" onClick={() => setSelectedRecord(null)}>‹ back to list</button>
              <div className="card">
                <div className="kv">
                  {source === "footfall" && (() => {
                    const r = selectedRecord as FootfallRecord;
                    return (
                      <>
                        <div className="k">Name</div><div>{r.name || "—"}</div>
                        <div className="k">Project</div><div>{r.project}</div>
                        <div className="k">Stage</div><div>{r.stage}</div>
                        <div className="k">Category</div><div>{r.category}</div>
                        <div className="k">Walk-in Source</div><div>{r.source}</div>
                        <div className="k">Channel Partner</div><div>{r.cp}</div>
                        <div className="k">Age</div><div>{r.age}</div>
                        <div className="k">Locality</div><div>{r.locality}</div>
                        <div className="k">Sales Gallery</div><div>{r.gallery || "—"}</div>
                        <div className="k">Enquiry created</div><div>{monthLabel(r.createdYear, r.createdMonth)}</div>
                        <div className="k">Site visit</div><div>{monthLabel(r.visitYear, r.visitMonth)}</div>
                        <div className="k">Opportunity No.</div><div style={{ fontSize: 12 }}>{r.oppNo || "—"}</div>
                      </>
                    );
                  })()}
                  {source === "cpvisits" && (() => {
                    const r = selectedRecord as CpVisitRecord;
                    return (
                      <>
                        <div className="k">Name</div><div>{r.name || "—"}</div>
                        <div className="k">Project</div><div>{r.project}</div>
                        <div className="k">Channel Partner</div><div>{r.cp}</div>
                        <div className="k">Status</div><div>{r.status}</div>
                        <div className="k">Subject</div><div>{r.subject}</div>
                        <div className="k">Visit type</div><div>{r.visitType}</div>
                        <div className="k">No. of visitors</div><div>{r.visitors}</div>
                        <div className="k">Sales Gallery</div><div>{r.gallery || "—"}</div>
                        <div className="k">Visit date</div><div>{monthLabel(r.year, r.month)}</div>
                      </>
                    );
                  })()}
                  {source === "digital" && (() => {
                    const r = selectedRecord as DigitalRecord;
                    return (
                      <>
                        <div className="k">Project</div><div>{r.project}</div>
                        <div className="k">Status</div><div>{r.status}</div>
                        <div className="k">Stage</div><div>{r.stage}</div>
                        <div className="k">Source</div><div>{r.subSource}</div>
                        {r.utmSource && <><div className="k">UTM source</div><div>{r.utmSource}</div></>}
                        {r.agencySource && <><div className="k">Agency source</div><div>{r.agencySource}</div></>}
                        <div className="k">Enquiry created</div><div>{monthLabel(r.year, r.month)}</div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          ) : !current.project ? (
            <>
              <div className="insight">{scoped.length.toLocaleString("en-IN")} records in this scope</div>
              <div className="card">
                <h3>By project <span className="hint">click → project</span></h3>
                {byProject.map(p => (
                  <div className="barrow" key={p.key} onClick={() => push({ label: p.key, project: p.key })}>
                    <div className="lbl">
                      <span className="nm">{p.key}</span>
                      <span className="r">{p.count.toLocaleString("en-IN")} ({p.pct}%)</span>
                    </div>
                    <div className="vbar" style={{ width: `${(p.count / byProject[0].count) * 100}%` }} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="card">
              <h3>Records <span className="hint">click → detail</span>{projectScope.length > 200 && <span className="hint"> (first 200 of {projectScope.length})</span>}</h3>
              <table>
                <thead>
                  <tr>
                    {source === "footfall" && <><th>Name</th><th>Stage</th><th>Category</th><th>CP</th></>}
                    {source === "cpvisits" && <><th>Name</th><th>Status</th><th>Subject</th><th>CP</th></>}
                    {source === "digital" && <><th>Status</th><th>Stage</th><th>Source</th></>}
                  </tr>
                </thead>
                <tbody>
                  {projectScope.slice(0, 200).map((r, i) => (
                    <tr key={i} onClick={() => setSelectedRecord(r)}>
                      {source === "footfall" && (() => { const rr = r as FootfallRecord; return <><td>{rr.name || "—"}</td><td>{rr.stage}</td><td>{rr.category}</td><td>{rr.cp}</td></>; })()}
                      {source === "cpvisits" && (() => { const rr = r as CpVisitRecord; return <><td>{rr.name || "—"}</td><td>{rr.status}</td><td>{rr.subject}</td><td>{rr.cp}</td></>; })()}
                      {source === "digital" && (() => { const rr = r as DigitalRecord; return <><td>{rr.status}</td><td>{rr.stage}</td><td>{rr.subSource}</td></>; })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
