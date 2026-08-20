import { useMemo, useRef, useState, useEffect } from "react";
import rawTarget from "../../data/targetData.json";
// import rawSales from "../../data/salesPDRN.json";
import rawTV from "../../data/tvAnalytics.json";
import "../../components/inventory/smartworldInventory.css";
import { CollapsibleCard } from "../../components/common/CollapsibleCard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProjectTarget { name: string; units:{monthly:number[];total:number}; area:{monthly:number[];total:number}; rate:{monthly:number[];total:number}; sale_value:{monthly:number[];total:number}; }
interface TargetData { months:string[]; projects:ProjectTarget[]; }
// interface PdrnData { P:string[]; TW:string[]; FL:string[]; CFG:string[]; R:number[][]; }
interface UnitRecord { unitNo:string; tower:string; floor:number; cfg:string; area:number; tsv:number; rate:number; year:number; month:number; }
interface TowerRow { name:string; sold:number; unsold:number; total:number; sold_pct:number; tsv:number; avg_rate:number; }
interface CfgRow { name:string; sold:number; unsold:number; total:number; sold_pct:number; avg_area:number; }
interface ProjectAnalytics { name:string; sold:number; tsv:number; area:number; avg_rate:number; monthly_units:number[]; monthly_tsv:number[]; monthly_area:number[]; towers:TowerRow[]; configs:CfgRow[]; units:UnitRecord[]; }
interface TVData { monthly_rates:{key:string;rate:number;units:number}[]; projects:ProjectAnalytics[]; }

const TD = rawTarget as TargetData;
// const PD = rawSales as unknown as PdrnData;
const TV = rawTV as unknown as TVData;
const MONTHS = TD.months;

// Target project names now exactly match PDRN names — no mapping needed
const TARGET_TO_PDRN = (name: string) => name;

// @ts-ignore
function fy_idx(y:number,m:number){
  if(y===2026&&m>=4) return m-4;
  if(y===2027&&m<=3) return 9+m-1;
  return -1;
}

// ── Drill-down panel ──────────────────────────────────────────────────────────
interface DrillContext { type:'project'|'tower'|'unit'; projectName?:string; towerName?:string; }

function DrillPanel({ ctx, onClose }: { ctx:DrillContext; onClose:()=>void }) {
  const [level, setLevel] = useState(0); // 0=project, 1=tower, 2=units
  const [selectedTower, setSelectedTower] = useState<TowerRow|null>(null);

  const proj = TV.projects.find(p => p.name === ctx.projectName);

  useEffect(() => { setLevel(0); setSelectedTower(null); }, [ctx.projectName]);

  if (!proj) return null;

  const crumbs = ['Project', selectedTower ? selectedTower.name : '', level===2 ? 'Units' : ''].filter(Boolean);

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(10,15,30,0.55)',backdropFilter:'blur(2px)' }} />
      {/* Panel */}
      <div style={{ position:'fixed',right:0,top:0,bottom:0,zIndex:201,width:440,background:'#fff',boxShadow:'-8px 0 40px rgba(0,0,0,.25)',display:'flex',flexDirection:'column',overflowY:'auto' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#0f1c36 0%,#1e3163 100%)',padding:'18px 20px 14px',flexShrink:0,borderBottom:'3px solid #B8893C' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
            <div style={{ fontFamily:'Georgia,serif',fontSize:17,fontWeight:700,color:'#fff',lineHeight:1.2 }}>{proj.name}</div>
            <button onClick={onClose} style={{ background:'none',border:'none',color:'#a9b2c7',fontSize:22,cursor:'pointer',lineHeight:1 }}>✕</button>
          </div>
          {/* Breadcrumbs */}
          <div style={{ display:'flex',gap:6,alignItems:'center',flexWrap:'wrap' }}>
            {crumbs.map((c,i) => (
              <span key={i} style={{ display:'flex',alignItems:'center',gap:6 }}>
                <span onClick={() => { if(i===0){setLevel(0);setSelectedTower(null);} else if(i===1) setLevel(1); }}
                  style={{ fontSize:12,color:i===crumbs.length-1?'#B8893C':'#a9b2c7',cursor:i<crumbs.length-1?'pointer':'default',fontWeight:i===crumbs.length-1?700:400 }}>
                  {c}
                </span>
                {i<crumbs.length-1 && <span style={{ color:'#5a6478',fontSize:12 }}>›</span>}
              </span>
            ))}
          </div>
          {/* Mini KPIs */}
          <div style={{ display:'flex',gap:10,marginTop:12 }}>
            {[['Sold',proj.sold.toLocaleString('en-IN'),'#1a7a4a'],['Area',`${proj.area}L sqft`,'#B8893C'],['TSV',`₹${proj.tsv}Cr`,'#B8893C'],['Unsold',`${proj.towers.reduce((s,t)=>s+t.unsold,0)}`,'#c0392b']].map(([k,v,c])=>(
              <div key={k} style={{ flex:1,background:'rgba(255,255,255,0.07)',borderRadius:8,padding:'8px 10px' }}>
                <div style={{ fontSize:10,color:'#a9b2c7',marginBottom:2 }}>{k}</div>
                <div style={{ fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1,padding:'16px 18px',display:'flex',flexDirection:'column',gap:14 }}>
          {/* Level 0: Tower ranking */}
          {level===0 && (
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:'#14213d',marginBottom:10,display:'flex',justifyContent:'space-between' }}>
                Tower breakdown
                <span style={{ fontSize:11,color:'#B8893C',fontWeight:400 }}>click → tower detail</span>
              </div>
              {[...proj.towers].sort((a,b)=>b.sold-a.sold).map(tw => (
                <div key={tw.name} onClick={() => { setSelectedTower(tw); setLevel(1); }}
                  style={{ cursor:'pointer',marginBottom:12,padding:'10px 12px',borderRadius:9,border:'1px solid #e4e0d6',transition:'background 0.12s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#faf9f6'}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background=''}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                    <span style={{ fontSize:13.5,fontWeight:700,color:'#14213d' }}>{tw.name}</span>
                    <span style={{ fontSize:12,color:'#8a8f9e' }}>{tw.sold} sold · {tw.sold_pct}% · ₹{tw.tsv}Cr</span>
                  </div>
                  <div style={{ background:'#e8e4dc',borderRadius:4,height:10,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${tw.sold_pct}%`,background:tw.sold_pct>=80?'#1a7a4a':tw.sold_pct>=60?'#B8893C':'#c0392b',borderRadius:4 }} />
                  </div>
                  <div style={{ display:'flex',justifyContent:'space-between',marginTop:4,fontSize:11,color:'#9ca3af' }}>
                    <span>{tw.sold} sold / {tw.total} total</span>
                    <span>Avg ₹{tw.avg_rate?.toLocaleString('en-IN')}/sqft</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Level 1: BHK config */}
          {level===1 && selectedTower && (
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:'#14213d',marginBottom:10,display:'flex',justifyContent:'space-between' }}>
                {selectedTower.name} — by configuration
                <span onClick={() => setLevel(2)} style={{ fontSize:11,color:'#B8893C',cursor:'pointer' }}>View units ›</span>
              </div>
              <div style={{ background:'#f4f2ed',borderRadius:9,padding:'12px 14px',marginBottom:12 }}>
                <div style={{ display:'flex',gap:16,fontSize:13 }}>
                  <div><div style={{ fontSize:10,color:'#8a8f9e' }}>Sold</div><div style={{ fontWeight:700,color:'#1a7a4a',fontSize:16 }}>{selectedTower.sold}</div></div>
                  <div><div style={{ fontSize:10,color:'#8a8f9e' }}>Unsold</div><div style={{ fontWeight:700,color:'#c0392b',fontSize:16 }}>{selectedTower.unsold}</div></div>
                  <div><div style={{ fontSize:10,color:'#8a8f9e' }}>% Sold</div><div style={{ fontWeight:700,color:'#B8893C',fontSize:16 }}>{selectedTower.sold_pct}%</div></div>
                  <div><div style={{ fontSize:10,color:'#8a8f9e' }}>TSV</div><div style={{ fontWeight:700,color:'#14213d',fontSize:16 }}>₹{selectedTower.tsv}Cr</div></div>
                </div>
              </div>
              {proj.configs.map(cfg => (
                <div key={cfg.name} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',fontSize:12.5,marginBottom:4 }}>
                    <span style={{ fontWeight:600 }}>{cfg.name}</span>
                    <span style={{ color:'#8a8f9e' }}>{cfg.sold} sold / {cfg.total} total · avg {cfg.avg_area?.toLocaleString('en-IN')}sqft</span>
                  </div>
                  <div style={{ background:'#e8e4dc',borderRadius:4,height:9,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${cfg.sold_pct}%`,background:'#1a7a4a',borderRadius:4 }} />
                  </div>
                  <div style={{ fontSize:11,color:'#9ca3af',marginTop:2 }}>{cfg.sold_pct}% sold</div>
                </div>
              ))}
            </div>
          )}

          {/* Level 2: Unit records */}
          {level===2 && (
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:'#14213d',marginBottom:10 }}>
                Unit records {proj.units.length>100?'(first 100)':''}
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#f4f2ed' }}>
                      {['Unit','Tower','Floor','BHK','Area (sqft)','₹ Cr','Rate/sqft'].map(h=>(
                        <th key={h} style={{ padding:'8px 10px',textAlign:'left',fontWeight:700,fontSize:11,color:'#6b7280',whiteSpace:'nowrap',borderBottom:'2px solid #e4e0d6' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proj.units.slice(0,100).map((u,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f0ede6',background:i%2===0?'#fff':'#faf9f6' }}>
                        <td style={{ padding:'7px 10px',fontWeight:600,color:'#14213d' }}>{u.unitNo}</td>
                        <td style={{ padding:'7px 10px',color:'#6b7280' }}>{u.tower}</td>
                        <td style={{ padding:'7px 10px',color:'#6b7280' }}>{u.floor}</td>
                        <td style={{ padding:'7px 10px' }}><span style={{ background:'#e8f4f0',color:'#0f6e56',borderRadius:5,padding:'2px 8px',fontSize:11,fontWeight:600 }}>{u.cfg}</span></td>
                        <td style={{ padding:'7px 10px',color:'#14213d' }}>{u.area?.toLocaleString('en-IN')}</td>
                        <td style={{ padding:'7px 10px',color:'#B8893C',fontWeight:600 }}>{u.tsv}</td>
                        <td style={{ padding:'7px 10px',color:'#6b7280' }}>₹{u.rate?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div style={{ borderTop:'1px solid #e4e0d6',padding:'12px 18px',display:'flex',alignItems:'center',gap:12,flexShrink:0,background:'#fff' }}>
          {level>0 && <button onClick={()=>{setLevel(l=>l-1);if(level===1)setSelectedTower(null);}} style={{ background:'#1E3163',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>← Back</button>}
          <div style={{ display:'flex',gap:5 }}>
            {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,borderRadius:4,background:level===i?'#B8893C':'#e4e0d6' }} />)}
          </div>
          <div style={{ flex:1 }}/>
          <span style={{ fontSize:11,color:'#9ca3af' }}>Level {level+1}/3</span>
        </div>
      </div>
    </>
  );
}

// ── Bar chart helpers ─────────────────────────────────────────────────────────
function GroupedBar({ months, target, actual, label, formatVal, badge }:
  {months:string[];target:number[];actual:number[];label:string;formatVal:(n:number)=>string;badge:string}) {
  const max = Math.max(...target, ...actual, 1);
  const [window, setWindow] = useState(0);
  const visCount = 8;
  const visMonths = months.slice(window, window+visCount);
  const visTgt = target.slice(window, window+visCount);
  const visAct = actual.slice(window, window+visCount);

  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
        <div style={{ fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'#14213d' }}>{label}</div>
        <div style={{ background:'#0f3460',color:'#fff',borderRadius:6,padding:'4px 12px',fontSize:13,fontWeight:700 }}>{badge}</div>
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
        <button onClick={()=>setWindow(w=>Math.max(0,w-1))} disabled={window===0} style={{ background:'#f4f2ed',border:'none',borderRadius:4,width:24,height:24,cursor:'pointer',fontSize:14,color:'#6b7280' }}>‹</button>
        <div style={{ flex:1,display:'flex',gap:4,alignItems:'flex-end',height:140 }}>
          {visMonths.map((m,i)=>{
            const t=visTgt[i]||0,a=visAct[i]||0;
            const behind = a<t;
            return (
              <div key={i} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}>
                <div style={{ display:'flex',gap:2,alignItems:'flex-end',height:120 }}>
                  {/* Actual bar */}
                  <div style={{ width:14,background:'#22c55e',borderRadius:'3px 3px 0 0',height:`${(a/max)*100}%`,minHeight:a?4:0,position:'relative' }}>
                    {behind&&a>0&&<div style={{ position:'absolute',top:-20,left:-6,background:'#ef4444',color:'#fff',borderRadius:4,padding:'1px 5px',fontSize:9,fontWeight:700,whiteSpace:'nowrap' }}>▲{formatVal(t-a)}</div>}
                  </div>
                  {/* Target bar */}
                  <div style={{ width:14,background:'#d1d5db',borderRadius:'3px 3px 0 0',height:`${(t/max)*100}%`,minHeight:t?4:0 }} />
                </div>
                <div style={{ fontSize:9,color:'#9ca3af',textAlign:'center',lineHeight:1.2,whiteSpace:'nowrap' }}>{m.replace('-',' ')}</div>
                <div style={{ fontSize:9,color:'#22c55e',fontWeight:600 }}>{formatVal(a)}</div>
              </div>
            );
          })}
        </div>
        <button onClick={()=>setWindow(w=>Math.min(months.length-visCount,w+1))} disabled={window>=months.length-visCount} style={{ background:'#f4f2ed',border:'none',borderRadius:4,width:24,height:24,cursor:'pointer',fontSize:14,color:'#6b7280' }}>›</button>
      </div>
      <div style={{ display:'flex',gap:14,fontSize:11 }}>
        <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'#22c55e',marginRight:4 }}/>Achieved</span>
        <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'#d1d5db',marginRight:4 }}/>Target</span>
      </div>
    </div>
  );
}

// ── Rate line chart ───────────────────────────────────────────────────────────
function RateTrendChart({ data, targetAvg }: { data:{key:string;rate:number;units:number}[]; targetAvg:number }) {
  const min = Math.min(...data.map(d=>d.rate)) * 0.95;
  const max = Math.max(...data.map(d=>d.rate)) * 1.05;
  const W=520, H=140, PAD={l:50,r:10,t:10,b:30};
  const innerW=W-PAD.l-PAD.r, innerH=H-PAD.t-PAD.b;
  const x=(i:number)=>PAD.l+i*(innerW/(data.length-1));
  const y=(v:number)=>PAD.t+innerH-(((v-min)/(max-min))*innerH);
  const linePath=data.map((d,i)=>`${i===0?'M':'L'}${x(i)} ${y(d.rate)}`).join(' ');
  const targetY=y(targetAvg);
  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'#14213d',marginBottom:10 }}>Rate Trend (₹/sqft)</div>
      <div style={{ overflowX:'auto' }}>
        <svg width={W} height={H} style={{ display:'block' }}>
          {/* Grid */}
          {[0,0.25,0.5,0.75,1].map(t=>{
            const yv=PAD.t+innerH*t;
            return <line key={t} x1={PAD.l} x2={W-PAD.r} y1={yv} y2={yv} stroke="#e4e0d6" strokeDasharray="3,3"/>;
          })}
          {/* Y labels */}
          {[0,0.5,1].map(t=>{
            const v=min+(max-min)*(1-t);
            return <text key={t} x={PAD.l-5} y={PAD.t+innerH*t+4} fontSize="9" fill="#9ca3af" textAnchor="end">₹{Math.round(v/1000)}k</text>;
          })}
          {/* Target line */}
          <line x1={PAD.l} x2={W-PAD.r} y1={targetY} y2={targetY} stroke="#1E3163" strokeDasharray="5,3" strokeWidth="1.5" opacity="0.6"/>
          {/* Rate line */}
          <path d={linePath} fill="none" stroke="#7b1414" strokeWidth="1.8"/>
          {/* Dots */}
          {data.map((d,i)=><circle key={i} cx={x(i)} cy={y(d.rate)} r="3" fill="#7b1414"/>)}
          {/* X labels (every 4) */}
          {data.filter((_,i)=>i%4===0).map((d,i)=>{
            const fullI=i*4;
            return <text key={d.key} x={x(fullI)} y={H-2} fontSize="8" fill="#9ca3af" textAnchor="middle">{d.key.slice(0,7)}</text>;
          })}
        </svg>
      </div>
      <div style={{ display:'flex',gap:14,fontSize:11,marginTop:8 }}>
        <span><span style={{ display:'inline-block',width:18,height:2,background:'#7b1414',marginRight:4,verticalAlign:'middle' }}/>Achieved Rate</span>
        <span><span style={{ display:'inline-block',width:18,height:2,background:'#1E3163',marginRight:4,verticalAlign:'middle',borderTop:'2px dashed #1E3163' }}/>Target Rate</span>
      </div>
    </div>
  );
}

// ── Tower sold % chart ────────────────────────────────────────────────────────
function TowerSoldChart({ proj, onTowerClick }: { proj:ProjectAnalytics; onTowerClick:(t:TowerRow)=>void }) {
  const towers = proj.towers.filter(t=>t.total>0).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  const BAR_W=40, GAP=20, PAD={l:20,r:20,t:30,b:30};
  const innerW=towers.length*(BAR_W*2+GAP+10);
  const W=innerW+PAD.l+PAD.r, H=160;
  const barH=(pct:number)=>((H-PAD.t-PAD.b)*pct/100);
  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'#14213d',marginBottom:10 }}>Tower Wise Sold %</div>
      <div style={{ overflowX:'auto' }}>
        <svg width={Math.max(W,400)} height={H} style={{ display:'block' }}>
          {towers.map((tw,i)=>{
            const bx=PAD.l+i*(BAR_W*2+GAP+20);
            const unitH=barH(tw.sold_pct);
            const tsvPct=tw.tsv/(proj.tsv||1)*100;
            const tsvH=barH(Math.min(tsvPct*tw.total/proj.sold*100,100));
            const baseY=H-PAD.b;
            const isWeak=tw.sold_pct<50;
            return (
              <g key={tw.name} onClick={()=>onTowerClick(tw)} style={{ cursor:'pointer' }}>
                {/* TSV % bar */}
                <rect x={bx} y={baseY-tsvH} width={BAR_W} height={tsvH} fill={isWeak?'#f97316':'#f97316'} rx="2" opacity={isWeak?0.4:0.9}/>
                <text x={bx+BAR_W/2} y={baseY-tsvH-4} fontSize="9" fill="#f97316" textAnchor="middle" fontWeight="700">{Math.round(tsvPct)}%</text>
                {/* Unit % bar */}
                <rect x={bx+BAR_W+4} y={baseY-unitH} width={BAR_W} height={unitH} fill={isWeak?'#0ea5e9':'#0ea5e9'} rx="2" opacity={isWeak?0.4:0.9}/>
                <text x={bx+BAR_W+4+BAR_W/2} y={baseY-unitH-4} fontSize="9" fill="#0ea5e9" textAnchor="middle" fontWeight="700">{tw.sold_pct}%</text>
                {/* Label */}
                <text x={bx+BAR_W+2} y={H-4} fontSize="10" fill="#6b7280" textAnchor="middle">{tw.name.length>6?tw.name.slice(0,4):tw.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display:'flex',gap:14,fontSize:11,marginTop:4 }}>
        <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'#f97316',marginRight:4 }}/>TSV % Sold</span>
        <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'#0ea5e9',marginRight:4 }}/>Unit % Sold</span>
      </div>
    </div>
  );
}

// ── Type wise % sale ──────────────────────────────────────────────────────────
function TypeWiseChart({ proj }: { proj:ProjectAnalytics }) {
  const cfgs = proj.configs.filter(c=>c.total>0);
  const BAR_W=50, GAP=30, PAD={l:30,r:40,t:30,b:30};
  const W=cfgs.length*(BAR_W*2+GAP+10)+PAD.l+PAD.r, H=160;
  const maxUnits=Math.max(...cfgs.map(c=>c.total),1);
  const barH=(n:number)=>(((H-PAD.t-PAD.b)*n/maxUnits));
  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'#14213d',marginBottom:10 }}>Type Wise % Sale</div>
      <div style={{ overflowX:'auto' }}>
        <svg width={Math.max(W,360)} height={H} style={{ display:'block' }}>
          {cfgs.map((cfg,i)=>{
            const bx=PAD.l+i*(BAR_W*2+GAP+10);
            const baseY=H-PAD.b;
            const soldH=barH(cfg.sold), unsoldH=barH(cfg.unsold);
            return (
              <g key={cfg.name}>
                <rect x={bx} y={baseY-soldH} width={BAR_W} height={soldH} fill="#0e7490" rx="2"/>
                <rect x={bx+BAR_W+4} y={baseY-unsoldH} width={BAR_W} height={unsoldH} fill="#a5f3fc" rx="2"/>
                <text x={bx+BAR_W/2} y={baseY-soldH-4} fontSize="9" fill="#0e7490" textAnchor="middle" fontWeight="700">{cfg.sold_pct}%</text>
                <text x={bx+BAR_W+2} y={H-4} fontSize="10" fill="#6b7280" textAnchor="middle">{cfg.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display:'flex',gap:14,fontSize:11,marginTop:4 }}>
        <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'#0e7490',marginRight:4 }}/>Sold</span>
        <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'#a5f3fc',marginRight:4 }}/>Unsold</span>
      </div>
    </div>
  );
}

// ── Multi-select project dropdown ─────────────────────────────────────────────
function ProjectDropdown({ projects, selected, onChange }:{ projects:string[]; selected:Set<string>; onChange:(s:Set<string>)=>void; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e:MouseEvent){ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);
  function toggle(n:string){ const nx=new Set(selected); nx.has(n)?nx.delete(n):nx.add(n); if(nx.size===projects.length) onChange(new Set()); else onChange(nx); }
  const label=selected.size===0?'All projects':selected.size===1?[...selected][0]:`${selected.size} projects`;
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <label style={{ display:'block',fontSize:10,letterSpacing:'1.5px',textTransform:'uppercase',color:'#A9B2C7',marginBottom:5 }}>Project</label>
      <button type="button" onClick={()=>setOpen(v=>!v)} style={{ minWidth:200,background:'#1D2A4A',color:'#fff',border:'1px solid #33406B',borderRadius:7,padding:'9px 34px 9px 13px',fontSize:13.5,fontFamily:'inherit',cursor:'pointer',textAlign:'left' }}>
        {label} <span style={{ color:'#B8893C' }}>▾</span>
      </button>
      {open&&<div style={{ position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:60,background:'#fff',border:'1px solid var(--line)',borderRadius:9,boxShadow:'0 12px 34px rgba(20,33,61,.2)',padding:8,minWidth:260,maxHeight:300,overflowY:'auto' }}>
        <label style={{ display:'flex',alignItems:'center',gap:9,padding:'6px 9px',borderBottom:'1px solid var(--line)',marginBottom:5,paddingBottom:10,fontSize:13,color:'var(--ink)',cursor:'pointer',fontWeight:600 }}>
          <input type="checkbox" checked={selected.size===0} onChange={()=>onChange(new Set())} style={{ accentColor:'#B8893C',width:15,height:15 }} /> All projects
        </label>
        {projects.map(n=><label key={n} style={{ display:'flex',alignItems:'center',gap:9,padding:'6px 9px',borderRadius:6,fontSize:13,color:'var(--ink)',cursor:'pointer' }}>
          <input type="checkbox" checked={selected.has(n)} onChange={()=>toggle(n)} style={{ accentColor:'#B8893C',width:15,height:15 }} />{n}
        </label>)}
      </div>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type MonthFilter='all'|string;

export function TargetActualPage() {
  const [selProjects, setSelProjects] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<MonthFilter>('all');
  const [drillCtx, setDrillCtx] = useState<DrillContext|null>(null);
  const [selPdrnProj, setSelPdrnProj] = useState<string>(TV.projects[0]?.name ?? '');

  const pdrnProj = TV.projects.find(p=>p.name===selPdrnProj) ?? TV.projects[0];

  // Aggregate targets + actuals for all target projects
  const agg = useMemo(()=>{
    const visTargetProjs = TD.projects.filter(p => selProjects.size===0 || selProjects.has(p.name));
    const mRange = selMonth==='all' ? Array.from({length:12},(_,i)=>i) : [MONTHS.indexOf(selMonth)];
    let tU=0,tV=0,tA=0,aU=0,aV=0,aA=0;
    const rows: {name:string;tgtU:number;actU:number;tgtV:number;actV:number}[] = [];
    visTargetProjs.forEach(p=>{
      const pdrnData = TV.projects.find(x=>x.name===TARGET_TO_PDRN(p.name)) ?? null;
      const ptu=mRange.reduce((s,i)=>s+(p.units.monthly[i]??0),0);
      const ptv=mRange.reduce((s,i)=>s+(p.sale_value.monthly[i]??0),0);
      const pta=mRange.reduce((s,i)=>s+(p.area.monthly[i]??0),0)/100000;
      const pau=pdrnData?mRange.reduce((s,i)=>s+(pdrnData.monthly_units[i]??0),0):0;
      const pav=pdrnData?mRange.reduce((s,i)=>s+(pdrnData.monthly_tsv[i]??0),0):0;
      const paa=pdrnData?mRange.reduce((s,i)=>s+(pdrnData.monthly_area[i]??0),0):0;
      tU+=ptu; tV+=ptv; tA+=pta; aU+=pau; aV+=pav; aA+=paa;
      rows.push({name:p.name,tgtU:ptu,actU:pau,tgtV:ptv,actV:pav});
    });
    const monthlyTgt=MONTHS.map((_,i)=>visTargetProjs.reduce((s,p)=>s+(p.units.monthly[i]??0),0));
    const monthlyAct=MONTHS.map((_,i)=>visTargetProjs.reduce((s,p)=>{
      const pd2=TV.projects.find(x=>x.name===TARGET_TO_PDRN(p.name))??null;
      return s+(pd2?pd2.monthly_units[i]??0:0);
    },0));
    const monthlyTgtV=MONTHS.map((_,i)=>visTargetProjs.reduce((s,p)=>s+(p.sale_value.monthly[i]??0),0));
    const monthlyActV=MONTHS.map((_,i)=>visTargetProjs.reduce((s,p)=>{
      const pd2=TV.projects.find(x=>x.name===TARGET_TO_PDRN(p.name))??null;
      return s+(pd2?pd2.monthly_tsv[i]??0:0);
    },0));
    const monthlyTgtA=MONTHS.map((_,i)=>visTargetProjs.reduce((s,p)=>s+(p.area.monthly[i]??0)/100000,0));
    const monthlyActA=MONTHS.map((_,i)=>visTargetProjs.reduce((s,p)=>{
      const pd2=TV.projects.find(x=>x.name===TARGET_TO_PDRN(p.name))??null;
      return s+(pd2?pd2.monthly_area[i]??0:0);
    },0));
    return { tU,tV,tA,aU,aV,aA,rows,monthlyTgt,monthlyAct,monthlyTgtV,monthlyActV,monthlyTgtA,monthlyActA };
  },[selProjects,selMonth]);

  const achPct=agg.tU>0?Math.round(agg.aU/agg.tU*100):0;

  // Target avg rate for selected projects
  const tgtAvgRate = useMemo(()=>{
    const ps = selProjects.size===0?TD.projects:TD.projects.filter(p=>selProjects.has(p.name));
    const rates = ps.flatMap(p=>p.rate.monthly.filter(r=>r>0));
    return rates.length?Math.round(rates.reduce((a,b)=>a+b)/rates.length):21500;
  },[selProjects]);

  return (
    <div className="sw-inv" style={{ minHeight:'100vh' }}>
      {/* Filter bar */}
      <div style={{ background:'linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)',padding:'12px 22px 14px',borderBottom:'3px solid var(--gold)',display:'flex',flexWrap:'wrap',alignItems:'flex-end',gap:14 }}>
        <ProjectDropdown projects={TD.projects.map(p=>p.name)} selected={selProjects} onChange={setSelProjects} />
        <div>
          <label style={{ display:'block',fontSize:10,letterSpacing:'1.5px',textTransform:'uppercase',color:'#A9B2C7',marginBottom:5 }}>Period</label>
          <div style={{ display:'flex',gap:5 }}>
            {(['all','year','quarter','month'] as const).map(t=>(
              <button key={t} onClick={()=>setSelMonth(t==='all'?'all':'')}
                style={{ background:selMonth==='all'&&t==='all'||(selMonth!==''&&t!=='all'&&t===selMonth)?'#B8893C':'#1D2A4A',color:'#fff',border:'1px solid #33406B',borderRadius:7,padding:'9px 13px',fontSize:12.5,fontFamily:'inherit',cursor:'pointer' }}>
                {t==='all'?'All time':t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display:'block',fontSize:10,letterSpacing:'1.5px',textTransform:'uppercase',color:'#A9B2C7',marginBottom:5 }}>Month</label>
          <select value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{ background:'#1D2A4A',color:'#fff',border:'1px solid #33406B',borderRadius:7,padding:'9px 28px 9px 13px',fontSize:13.5,fontFamily:'inherit',cursor:'pointer' }}>
            <option value="all">Full year</option>
            {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ flex:1 }} />
        <button onClick={()=>{setSelProjects(new Set());setSelMonth('all');}} style={{ background:'none',border:'none',color:'#c7cedf',fontSize:12.5,fontFamily:'inherit',cursor:'pointer',paddingBottom:9 }}>Reset</button>
      </div>

      <div className="wrap">
        {/* KPI strip */}
        <div className="kpis">
          {[
            {k:'Target Units',v:agg.tU.toLocaleString('en-IN'),s:'FY 2026-27',color:'#1E3163'},
            {k:'Actual Units',v:agg.aU.toLocaleString('en-IN'),s:`${achPct}% achieved`,color:'#1a7a4a'},
            {k:'Shortfall',v:Math.max(0,agg.tU-agg.aU).toLocaleString('en-IN'),s:'units remaining',color:agg.aU>=agg.tU?'#1a7a4a':'#c0392b'},
            {k:'Target Value',v:`₹${agg.tV.toFixed(0)}Cr`,s:'sale value plan',color:'#1E3163'},
            {k:'Actual Value',v:`₹${agg.aV.toFixed(1)}Cr`,s:'from PDRN bookings',color:'#1a7a4a'},
            {k:'Achievement',v:`${achPct}%`,s:'of unit target',color:achPct>=100?'#1a7a4a':achPct>=75?'#B8893C':'#c0392b'},
          ].map(item=>(
            <div key={item.k} className="kpi" style={{ borderTopColor:item.color,borderTopWidth:3 }}>
              <div className="k">{item.k}</div>
              <div className="v" style={{ color:item.color,fontSize:20 }}>{item.v}</div>
              <div className="s">{item.s}</div>
            </div>
          ))}
        </div>
        <div className="blkbar" style={{ marginBottom:14 }}>Target vs Actual · FY 2026-27 · Actuals from PDRN bookings {selMonth!=='all'&&<>· Month: <strong>{selMonth}</strong></>}</div>

        {/* Cards 1-3: Units, TSV, Area */}
        <div className="grid g2">
          <GroupedBar months={MONTHS} target={agg.monthlyTgt} actual={agg.monthlyAct}
            label="UNITS — Target vs Achieved" formatVal={n=>n.toFixed(0)} badge={`${agg.aU} Units Achieved`} />
          <GroupedBar months={MONTHS} target={agg.monthlyTgtV} actual={agg.monthlyActV}
            label="TSV — Target vs Achieved (₹ Cr)" formatVal={n=>`₹${n.toFixed(1)}Cr`} badge={`₹${agg.aV.toFixed(1)}Cr Achieved`} />
        </div>
        <GroupedBar months={MONTHS} target={agg.monthlyTgtA} actual={agg.monthlyActA}
          label="AREA — Target vs Achieved (L sqft)" formatVal={n=>`${n.toFixed(2)}L`} badge={`${agg.aA.toFixed(1)}L sqft Achieved`} />

        {/* Card 4: Rate trend */}
        <RateTrendChart data={TV.monthly_rates} targetAvg={tgtAvgRate} />

        {/* Project selector for cards 5-8 */}
        <div style={{ background:'#f4f2ed',borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:12.5,color:'#6b7280',fontWeight:600 }}>Project for tower/type charts:</span>
          <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
            {TV.projects.map(p=>(
              <button key={p.name} onClick={()=>setSelPdrnProj(p.name)}
                style={{ padding:'6px 12px',borderRadius:7,border:`1.5px solid ${selPdrnProj===p.name?'#1E3163':'#ddd8ce'}`,background:selPdrnProj===p.name?'#1E3163':'#fff',color:selPdrnProj===p.name?'#fff':'#4a5568',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:selPdrnProj===p.name?700:400 }}>
                {p.name.replace('SMARTWORLD ','SW ').replace('TRUMP RESIDENCES ','TRUMP ')}
              </button>
            ))}
          </div>
        </div>

        {/* Cards 5-6: Tower charts */}
        {pdrnProj && (
          <div className="grid g2">
            <TowerSoldChart proj={pdrnProj} onTowerClick={tw=>setDrillCtx({type:'tower',projectName:pdrnProj.name,towerName:tw.name})} />
            <CollapsibleCard title="Tower Absorption Ranking">
              {[...pdrnProj.towers].sort((a,b)=>b.sold_pct-a.sold_pct).map(tw=>(
                <div className="barrow" key={tw.name} onClick={()=>setDrillCtx({type:'tower',projectName:pdrnProj.name,towerName:tw.name})} style={{ cursor:'pointer' }}>
                  <div className="lbl">
                    <span className="nm">{tw.name} — {tw.sold_pct}% sold</span>
                    <span className="r">{tw.sold} sold · ₹{tw.tsv}Cr · avg ₹{tw.avg_rate?.toLocaleString('en-IN')}/sqft</span>
                  </div>
                  <div className="track">
                    <div className="a" style={{ width:`${tw.sold_pct}%`,background:tw.sold_pct>=80?'#1a7a4a':tw.sold_pct>=60?'#B8893C':'#c0392b' }} />
                  </div>
                </div>
              ))}
            </CollapsibleCard>
          </div>
        )}

        {/* Cards 7-8: Rate trend + Type wise */}
        {pdrnProj && (
          <div className="grid g2">
            <CollapsibleCard title={<>Rate trend over time <span className="hint">₹/sqft · avg booking rate</span></>}>
              <RateTrendChart data={TV.monthly_rates.filter(d=>{ const [y,_mm]=d.key.split('-').map(Number); return y>=2023; })} targetAvg={tgtAvgRate} />
            </CollapsibleCard>
            <TypeWiseChart proj={pdrnProj} />
          </div>
        )}

        {/* Project-wise breakdown table */}
        <CollapsibleCard title={<>Project-wise summary <span className="hint">target vs actual</span></>}>
          {agg.rows.filter(r=>r.tgtU>0||r.actU>0).map(row=>{
            const pct=row.tgtU>0?Math.round(row.actU/row.tgtU*100):0;
            const color=pct>=100?'#1a7a4a':pct>=75?'#B8893C':'#c0392b';
            const hasPdrn=TV.projects.some(x=>x.name===row.name);
            return (
              <div className="barrow" key={row.name} onClick={()=>{setDrillCtx({type:'project',projectName:TARGET_TO_PDRN(row.name)});}} style={{ cursor:'pointer' }}>
                <div className="lbl">
                  <span className="nm">{row.name}</span>
                  <span className="r" style={{ display:'flex',gap:12 }}>
                    <span style={{ color:'#c0bbb0' }}>Tgt: {row.tgtU}</span>
                    <span style={{ color }}>Act: {row.actU} ({pct}%)</span>
                    <span style={{ color:'var(--gold)' }}>₹{row.actV.toFixed(1)}Cr</span>
                  </span>
                </div>
                <div style={{ position:'relative',height:10,background:'#e8e4dc',borderRadius:3,marginTop:6,overflow:'hidden' }}>
                  <div style={{ position:'absolute',left:0,top:0,height:'100%',width:`${Math.min((row.tgtU/Math.max(...agg.rows.map(r=>r.tgtU),1))*100,100)}%`,background:'#c0bbb0',borderRadius:3 }}/>
                  <div style={{ position:'absolute',left:0,top:0,height:'100%',width:`${Math.min((row.actU/Math.max(...agg.rows.map(r=>r.tgtU),1))*100,100)}%`,background:color,borderRadius:3 }}/>
                </div>
              </div>
            );
          })}
        </CollapsibleCard>
      </div>

      {/* Drill-down panel */}
      {drillCtx && <DrillPanel ctx={drillCtx} onClose={()=>setDrillCtx(null)} />}
    </div>
  );
}
