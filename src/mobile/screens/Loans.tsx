import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import raw from "../../data/loanData.json";
import { AreaChart, Card, CardHead, Chip, Chips, Empty, FilterBar, FullViewLink, Funnel, HBars, Hero, Insight, Kpi, List, Pill, Progress, Row, SearchBar, Section, Sheet, type FilterField, type FilterValues } from "../ui";
import { fN, inrCr, pct, pctN } from "../fmt";

/* Same data & semantics as the desktop Loan Details page (ZSD loan report, one row per loan-funded booking). */
const TEAL = "#0e7490", GOLD = "#b8893c", GREEN = "#16a06f", RED = "#d64545", NAVY = "#1e3163", PURPLE = "#6b5f8f", AMBER = "#e0a100";
const EPOCH = Date.UTC(2022, 0, 1);
const DAY = 86400000;
const fD = (d: number) => (d < 0 ? "—" : new Date(EPOCH + d * DAY).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }));
const AS_ON = Math.round((Date.UTC(2026, 8, 28) - EPOCH) / DAY);

interface LoanFile { meta: { asOn: string }; PROJECTS: string[]; BANKS: string[]; EMPS: string[]; EXECS: string[]; PLANS: string[]; L: (string | number)[][] }
const D = raw as unknown as LoanFile;

interface Loan {
  proj: number; so: string; bookDay: number; unit: string; unitType: string; cost: number;
  bank: number; fileNo: string; fileDay: number;
  sanctAmt: number; sanctDay: number; disbAmt: number; disbPct: number; balance: number;
  ptmDay: number; tptDay: number; bbaDay: number; emp: number; exec: number; remark: string;
  stage: 0 | 1 | 2 | 3; sanctAge: number;
}
const STAGE_LBL = ["Sanction pending", "Awaiting 1st disbursement", "Partly disbursed", "Fully disbursed"] as const;
const STAGE_SHORT = ["No sanction", "Awaiting", "Partly", "Fully"] as const;
const STAGE_COL = [PURPLE, RED, GOLD, GREEN] as const;
const STAGE_TONE = ["gold", "bad", "warn", "ok"] as const;

const ALL: Loan[] = D.L.map(t => {
  const sanctAmt = t[14] as number, disbAmt = t[16] as number, disbPct = t[17] as number, sanctDay = t[15] as number;
  const stage: 0 | 1 | 2 | 3 = sanctAmt <= 0 ? 0 : disbAmt <= 0 ? 1 : disbPct >= 99 ? 3 : 2;
  return {
    proj: t[0] as number, so: String(t[1]), bookDay: t[2] as number,
    unit: String(t[5]), unitType: String(t[8]), cost: t[9] as number,
    bank: t[10] as number, fileNo: String(t[12]), fileDay: t[13] as number,
    sanctAmt, sanctDay, disbAmt, disbPct, balance: t[18] as number,
    ptmDay: t[19] as number, tptDay: t[20] as number, bbaDay: t[21] as number,
    emp: t[22] as number, exec: t[23] as number, remark: String(t[24]),
    stage, sanctAge: sanctDay >= 0 ? Math.max(0, AS_ON - sanctDay) : 0,
  };
});

const sum = (ls: Loan[], k: "sanctAmt" | "disbAmt" | "balance") => ls.reduce((s, l) => s + l[k], 0);
const projName = (i: number) => D.PROJECTS[i]?.replace("SMARTWORLD ", "") ?? "—";

const FIELDS: FilterField[] = [
  { key: "proj", label: "Project", options: D.PROJECTS.map((p, i) => ({ k: String(i), l: projName(i) || p })), allLabel: "All projects" },
  { key: "bank", label: "Bank", options: D.BANKS.map((b, i) => ({ b, i })).filter(x => x.b && x.b !== "—").sort((a, b) => a.b.localeCompare(b.b)).map(x => ({ k: String(x.i), l: x.b })), allLabel: "All banks" },
];

interface Drill { title: string; loans: Loan[] }

export default function Loans() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [f, setF] = useState<FilterValues>({});
  const [stage, setStage] = useState<"all" | "0" | "1" | "2" | "3">("all");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [cur, setCur] = useState<Loan | null>(null);
  const [dq, setDq] = useState("");

  const scoped = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ALL.filter(l => {
      if (f.proj && l.proj !== +f.proj) return false;
      if (f.bank && l.bank !== +f.bank) return false;
      if (stage !== "all" && l.stage !== +stage) return false;
      if (s && !l.unit.toLowerCase().includes(s) && !l.fileNo.toLowerCase().includes(s) && !l.so.toLowerCase().includes(s) &&
          !(D.BANKS[l.bank] ?? "").toLowerCase().includes(s) && !(D.EMPS[l.emp] ?? "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [f, stage, q]);

  const open = (title: string, loans: Loan[]) => { setCur(null); setDq(""); setDrill({ title, loans: [...loans].sort((a, b) => b.balance - a.balance) }); };
  const close = () => { setDrill(null); setCur(null); setDq(""); };

  const sanct = sum(scoped, "sanctAmt"), disb = sum(scoped, "disbAmt");
  const stages = [0, 1, 2, 3].map(st => scoped.filter(l => l.stage === st));

  const banks = useMemo(() => {
    const m = new Map<number, Loan[]>();
    scoped.forEach(l => { if (!m.has(l.bank)) m.set(l.bank, []); m.get(l.bank)!.push(l); });
    return [...m.entries()].map(([bi, ls]) => {
      const sa = sum(ls, "sanctAmt"), da = sum(ls, "disbAmt");
      const ages = ls.filter(l => l.stage === 1 || l.stage === 2).map(l => l.sanctAge);
      return { bi, ls, sa, da, pct: sa ? (da / sa) * 100 : 0, avgAge: ages.length ? ages.reduce((s, x) => s + x, 0) / ages.length : 0 };
    }).sort((a, b) => b.sa - a.sa);
  }, [scoped]);

  const projCards = useMemo(() => D.PROJECTS.map((p, pi) => {
    const ls = scoped.filter(l => l.proj === pi);
    return ls.length ? { p, pi, ls, sa: sum(ls, "sanctAmt"), da: sum(ls, "disbAmt") } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.sa - a.sa), [scoped]);

  const AGE = [["0–30 d", 0, 30], ["31–90 d", 31, 90], ["91–180 d", 91, 180], ["181–365 d", 181, 365], ["> 1 year", 366, 1e9]] as const;
  const ageBands = AGE.map(([lbl, lo, hi]) => {
    const ls = scoped.filter(l => (l.stage === 1 || l.stage === 2) && l.sanctAge >= lo && l.sanctAge <= hi);
    return { lbl, ls, amt: sum(ls, "balance"), col: lo >= 181 ? RED : lo >= 31 ? AMBER : GREEN };
  }).filter(b => b.ls.length);

  const months = useMemo(() => {
    const m = new Map<string, Loan[]>();
    scoped.forEach(l => {
      if (l.sanctDay < 0) return;
      const k = new Date(EPOCH + l.sanctDay * DAY).toISOString().slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    });
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [scoped]);
  const monthLbl = (k: string) => new Date(k + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

  const dRows = drill ? drill.loans.filter(l => { const t = dq.trim().toLowerCase(); return !t || l.unit.toLowerCase().includes(t) || l.fileNo.toLowerCase().includes(t); }) : [];
  const stuck = scoped.filter(l => (l.stage === 1 || l.stage === 2) && l.sanctAge > 180);

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Home loans</h1><p className="m-sub">Sanction to disbursement · as on {D.meta.asOn}</p></div>

      <FilterBar fields={FIELDS} values={f} onApply={setF} quick={["proj", "bank"]} />
      <Chips>
        <Chip on={stage === "all"} onClick={() => setStage("all")}>All stages</Chip>
        {STAGE_SHORT.map((s, i) => <Chip key={s} on={stage === String(i)} onClick={() => setStage(String(i) as "0")}>{s}</Chip>)}
      </Chips>
      <SearchBar value={q} onChange={setQ} placeholder="Unit / file no. / bank / handler" />

      {scoped.length === 0 ? <Empty title="No loan cases" sub="Nothing matches these filters." /> : <>
        <Hero label="Money still with banks" value={inrCr(sanct - disb)} sub={`${pct(disb, sanct)} of ${inrCr(sanct)} sanctioned has been disbursed`}
          cells={[{ v: fN(scoped.length), l: "Loan cases" }, { v: inrCr(sanct), l: "Sanctioned" }, { v: inrCr(disb), l: "Disbursed" }]}>
          <div style={{ marginTop: 12 }}><div className="m-seg-bar"><i style={{ width: `${pctN(disb, sanct)}%`, background: "#4fd1a0" }} /><i style={{ width: `${100 - pctN(disb, sanct)}%`, background: "#ffd48a" }} /></div></div>
        </Hero>

        <div className="m-grid2">
          <Kpi label="Loan cases" value={fN(scoped.length)} sub="bank-funded bookings" color={NAVY} accent onClick={() => open("All loan cases", scoped)} />
          <Kpi label="Stuck > 180 d" value={fN(stuck.length)} sub={`${inrCr(sum(stuck, "balance"))} waiting`} color={RED} accent onClick={() => open("Sanctioned > 180 days ago, not fully disbursed", stuck)} />
        </div>
        <Kpi label="Sanction pending" value={fN(stages[0].length)} sub="no bank sanction recorded yet" color={PURPLE} onClick={() => open(STAGE_LBL[0], stages[0])} />

        <Section title="Where every loan stands" />
        <Card>
          <Funnel colors={[PURPLE, RED, GOLD, GREEN]} stages={stages.map((ls, i) => ({ label: STAGE_SHORT[i], value: ls.length, sub: `${fN(ls.length)} · ${inrCr(sum(ls, "sanctAmt"))}` }))} />
        </Card>
        <List>
          {stages.map((ls, i) => (
            <Row key={i} title={STAGE_LBL[i]} sub={`${fN(ls.length)} cases · ${inrCr(sum(ls, "sanctAmt"))} sanctioned`}
              value={inrCr(sum(ls, "balance"))} valueSub="undisbursed" right={<Pill tone={STAGE_TONE[i]}>{fN(ls.length)}</Pill>} onClick={() => open(STAGE_LBL[i], ls)} />
          ))}
        </List>

        {ageBands.length > 0 && <>
          <Section title="How long has sanctioned money waited?" />
          <Card>
            <CardHead title="Sanction ageing" sub="Days since sanction, disbursement incomplete" />
            <div style={{ marginTop: 10 }}>
              <HBars format={v => fN(v)} rows={ageBands.map(b => ({ label: b.lbl, value: b.ls.length, color: b.col, sub: `${fN(b.ls.length)} cases · ${inrCr(b.amt)} undisbursed`, onClick: () => open(`Sanctioned ${b.lbl} ago, not fully disbursed`, b.ls) }))} />
            </div>
          </Card>
        </>}

        <Section title="Loan money by project" />
        <div className="m-hscroll">
          {projCards.map(b => (
            <div key={b.p} style={{ minWidth: 270, scrollSnapAlign: "start" }}>
              <Insight label={b.p.replace("SMARTWORLD ", "")} value={inrCr(b.sa)} sub={`${fN(b.ls.length)} cases · ${inrCr(b.sa - b.da)} undisbursed`}
                pct={pctN(b.da, b.sa)} color={TEAL} onClick={() => open(`${b.p} · loan cases`, b.ls)} />
            </div>
          ))}
        </div>

        <Section title="Who is slow to disburse?" />
        <List>
          {banks.slice(0, 12).map((b, i) => (
            <Row key={b.bi} rank={i + 1} title={D.BANKS[b.bi] || "—"} sub={`${fN(b.ls.length)} cases · avg wait ${b.avgAge ? Math.round(b.avgAge) + " d" : "—"}`}
              value={inrCr(b.sa)} valueSub={`${b.pct.toFixed(0)}% disbursed`}
              right={<Pill tone={b.pct >= 50 ? "ok" : b.pct >= 20 ? "warn" : "bad"}>{b.pct.toFixed(0)}%</Pill>} onClick={() => open(`${D.BANKS[b.bi]} · loan cases`, b.ls)} />
          ))}
        </List>
        {banks.length > 12 && <p className="m-sub" style={{ textAlign: "center" }}>Top 12 of {fN(banks.length)} banks by sanctioned amount. Use the bank filter for others.</p>}

        {months.length > 1 && <>
          <Section title="Sanctions over time" />
          <Card>
            <CardHead title="Loans sanctioned per month" sub="Number of customers sanctioned" />
            <AreaChart data={months.map(([k, ls]) => ({ label: `${monthLbl(k)} ${k.slice(2, 4)}`, value: ls.length }))} format={v => `${fN(v)} loans`} color={TEAL} />
          </Card>
        </>}

        <Card style={{ background: "#fdfaf3" }}>
          <CardHead title="How to read this" />
          <p className="m-sub" style={{ marginTop: 6 }}>Every case funds its booking through a bank loan. The bank first sanctions an amount, then disburses it in tranches as instalments fall due. Undisbursed balance is sanctioned money still with the bank.</p>
        </Card>
      </>}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!drill} onClose={close} title={cur ? `Unit ${cur.unit}` : drill?.title ?? ""}>
        {drill && cur && (
          <div>
            <button type="button" className="m-btn" style={{ marginBottom: 12 }} onClick={() => setCur(null)}>Back to list</button>
            <div style={{ marginBottom: 10 }}><Pill tone={STAGE_TONE[cur.stage]}>{STAGE_LBL[cur.stage]}</Pill></div>
            <div className="m-grid2" style={{ marginBottom: 12 }}>
              <Kpi label="Sanctioned" value={inrCr(cur.sanctAmt)} sub={cur.sanctDay >= 0 ? `on ${fD(cur.sanctDay)}${cur.sanctAge > 0 && cur.stage !== 3 ? ` · ${cur.sanctAge} d ago` : ""}` : "none yet"} color={TEAL} />
              <Kpi label="Disbursed" value={inrCr(cur.disbAmt)} sub={`${cur.disbPct.toFixed(1)}%`} color={GREEN} />
              <Kpi label="Undisbursed" value={inrCr(cur.balance)} color={GOLD} />
              <Kpi label="Total cost" value={inrCr(cur.cost)} sub={cur.unitType} color={NAVY} />
            </div>
            <Progress pct={cur.disbPct} color={GREEN} lg />
            <List>
              <Row title="Unit" sub={`${cur.unit} · ${cur.unitType} · ${projName(cur.proj)}`} />
              <Row title="Bank" sub={D.BANKS[cur.bank] || "—"} />
              <Row title="Loan file" sub={`${cur.fileNo || "—"} · ${fD(cur.fileDay)}`} />
              <Row title="Booking / BBA" sub={`${fD(cur.bookDay)} · BBA ${fD(cur.bbaDay)}`} />
              <Row title="PTM / TPT" sub={`${fD(cur.ptmDay)} · ${fD(cur.tptDay)}`} />
              <Row title="Handled by" sub={`${D.EMPS[cur.emp] || "—"}${D.EXECS[cur.exec] ? ` · ${D.EXECS[cur.exec]}` : ""}`} />
              {cur.remark && <Row title="Remark" sub={cur.remark} />}
            </List>
          </div>
        )}
        {drill && !cur && <>
          <div className="m-grid2" style={{ marginBottom: 12 }}>
            <Kpi label="Cases" value={fN(drill.loans.length)} color={NAVY} />
            <Kpi label="Sanctioned" value={inrCr(sum(drill.loans, "sanctAmt"))} color={TEAL} />
            <Kpi label="Disbursed" value={inrCr(sum(drill.loans, "disbAmt"))} color={GREEN} />
            <Kpi label="Undisbursed" value={inrCr(sum(drill.loans, "sanctAmt") - sum(drill.loans, "disbAmt"))} color={GOLD} />
          </div>
          <SearchBar value={dq} onChange={setDq} placeholder="Search unit or file no." />
          <div style={{ marginTop: 8 }}>
            {dRows.length === 0 ? <Empty title="No cases" sub="Try a different search." /> : <>
              <List>
                {dRows.slice(0, 80).map((l, i) => (
                  <Row key={l.so + l.unit + i} title={l.unit} sub={`${projName(l.proj)} · ${D.BANKS[l.bank] || "—"}`}
                    value={l.balance > 0 ? inrCr(l.balance) : "—"} valueSub={`${l.disbPct.toFixed(0)}% disb`}
                    right={<span style={{ width: 8, height: 8, borderRadius: 4, background: STAGE_COL[l.stage], flex: "0 0 auto" }} aria-label={STAGE_LBL[l.stage]} />}
                    onClick={() => setCur(l)} />
                ))}
              </List>
              {dRows.length > 80 && <p className="m-sub" style={{ textAlign: "center", marginTop: 8 }}>Showing top 80 of {fN(dRows.length)} by undisbursed balance. Search to narrow.</p>}
            </>}
          </div>
        </>}
      </Sheet>
    </div>
  );
}
