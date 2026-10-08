/** SmartDB assistant — built-in answer engine. Reads the dashboard's own
 * datasets (no network, no API key), so answers match the tabs exactly. */
import { canAccess } from "../../config/users";
import type { Answer, Ctx, Entity, Period, Section } from "./types";
import { DOMAINS } from "./registry";
import { buildCtx, entLabel, norm } from "./nlp";
import { EXAMPLES, freshness, greeting } from "./domains/meta";
import { text } from "./domains/common";

type Access = "all" | string[] | null | undefined;
interface Session { ents: Entity[]; period: Period | null; domain: string | null }
let session: Session = { ents: [], period: null, domain: null };
export const resetSession = () => { session = { ents: [], period: null, domain: null }; };

const SALES_DEPT_RX = /\bsales (dept|department|team|budget|expenses?|spend)\b|\b(budgets?|expenses?|expenditure|spend|costs?|utili[sz]ation) (of|for|in|on|by) (the )?sales\b/;
const compound = (nq: string) => /\b(and|also|plus|along with|as well as)\b|&|,/.test(nq);

function score(nq: string): Map<string, number> {
  // "sales department budget" is a cost department, not sales
  const s = nq.replace(/\bsales (dept|department|team|budget|expense\w*|spend\w*)/g, "saledept $1")
    .replace(/\b(budgets?|expenses?|expenditure|spend|costs?|utili[sz]ation) (of|for|in|on|by) (the )?sales\b/g, "$1 $2 saledept");
  const out = new Map<string, number>();
  for (const d of DOMAINS) {
    let t = 0;
    for (const [rx, w] of d.keywords) if (rx.test(s)) t += w;
    if (t > 0) out.set(d.id, t);
  }
  return out;
}

function pick(c: Ctx): string[] {
  const sc = score(c.nq);
  const has = (id: string, min = 3) => (sc.get(id) ?? 0) >= min;
  const comp = compound(c.nq);

  /* disambiguation */
  if (has("cpvisits", 5)) { sc.delete("cp"); if (!/\bfootfall\b/.test(c.nq)) sc.delete("footfall"); sc.delete("sales"); sc.delete("digital"); }
  if (has("pr2po", 4)) { sc.delete("cost"); sc.delete("cases"); sc.delete("collections"); if (!/\bpo ?9\d{9}/.test(c.raw)) sc.delete("sales"); }
  if (has("vendors", 5)) { sc.delete("cp"); if (!/\bbudget\b/.test(c.nq)) sc.delete("cost"); }
  if (has("cost", 5) && !/\b(sales|sold|booking)/.test(c.nq.replace(SALES_DEPT_RX, " "))) sc.delete("sales");
  if (has("inventory", 4) && sc.has("sales")) { if (!c.period.explicit || /\b(unsold|inventory|stock|available|total units)\b/.test(c.nq)) { if (!/\b(sales|bookings?|revenue|tsv)\b/.test(c.nq)) sc.delete("sales"); } }
  if (has("inventory", 3) && /\b(sell|sold|sale|sales|booked|bookings?)\b/.test(c.nq) && c.period.explicit && !/\b(unsold|inventory|stock|available)\b/.test(c.nq)) sc.delete("inventory");
  if (has("target", 5) && !comp) { sc.delete("sales"); sc.delete("inventory"); }
  if (has("collections", 4) && !comp) { sc.delete("sales"); sc.delete("cp"); }
  if (has("cp", 3) && has("sales", 3) && !/\b(sales|sold|bookings?)\b/.test(c.nq)) sc.delete("sales");
  if ((has("footfall", 4) || has("digital", 4)) && !comp) { sc.delete("sales"); sc.delete("cp"); }
  if (has("digital", 4) && has("footfall", 4) && !/\b(footfall|walk ?-?ins?|customer visits?)\b/.test(c.nq)) sc.delete("footfall");
  if (has("eoi", 5) && !comp) { sc.delete("sales"); sc.delete("collections"); sc.delete("inventory"); }
  if (has("loans", 5) && !comp) { sc.delete("sales"); sc.delete("collections"); sc.delete("cp"); }
  if (has("tracker", 4) && !comp) { sc.delete("inventory"); }
  if (has("cases", 4) && !comp) { sc.delete("sales"); sc.delete("collections"); sc.delete("digital"); }
  if (sc.has("digital") && /\bleads?\b/.test(c.nq) && has("footfall", 4)) sc.delete("digital");

  const chosen = [...sc.entries()].filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  // answer in the order the user asked
  const firstAt = (id: string) => {
    const d = DOMAINS.find(x => x.id === id)!;
    const at = d.keywords.map(([rx]) => c.nq.search(rx)).filter(i => i >= 0);
    return at.length ? Math.min(...at) : 1e9;
  };
  return chosen.sort((a, b) => firstAt(a) - firstAt(b));
}

function followUps(domain: string, c: Ctx): string[] {
  const P = c.ents.length ? entLabel(c.ents) : "";
  const q = (s: string) => (P ? `${P} ${s}` : s);
  switch (domain) {
    case "sales": return P
      ? [`${P} sales month-wise`, `${P} budget`, `${P} unsold inventory`, `${P} target vs actual this FY`]
      : ["Sales by project this financial year", "Which project sold the most last month?", "Total unsold units", "Target vs actual this FY"];
    case "inventory": return P ? [`${P} sold units last month`, `${P} unsold by configuration`, `${P} net due`, `${P} construction progress`] : ["Unsold units by project", "Which project has the most unsold units?", "Inventory by configuration"];
    case "target": return P ? [`${P} sales last month`, `${P} target vs actual month-wise`] : ["Target vs actual last month", "Target vs actual by project this FY"];
    case "collections": return P ? [`${P} sales this FY`, `${P} budget`, `${P} home loans sanctioned`] : ["Which project has the highest net due?", "Collections by project"];
    case "cost": return P ? [`${P} sales last month`, `${P} vendor payables`, `${P} PRs pending`] : ["Which entity has the highest budget?", "WBS lines over budget", "Marketing budget"];
    case "pr2po": return ["Which PRs are waiting longest?", "How many PRs are pending at NFA approval?", q("PRs pending")];
    case "cases": return P ? [`${P} complaints last month`, `${P} cases beyond TAT`] : ["Open complaints by project", "Cases beyond TAT", "Cases raised last month"];
    case "footfall": return P ? [`${P} footfall by source`, `${P} digital leads last month`] : ["Footfall by project last month", "Gallery visits by source this year"];
    case "digital": return P ? [`${P} footfall last month`, `${P} sales last month`] : ["Digital leads by source", "Enquiries last month"];
    default: return EXAMPLES.slice(0, 3).map(e => e[1]);
  }
}

export async function ask(question: string, access: Access): Promise<Answer> {
  const raw = question.trim();
  const nq = norm(raw);
  if (!nq) return { headline: greeting().headline, sections: [greeting()], followUps: EXAMPLES.slice(0, 4).map(e => e[1]), notes: [] };

  const short = nq.split(" ").length <= 4;
  if ((/^(hi+|hello+|hey+|namaste|hola|good (morning|afternoon|evening))\b/.test(nq) && short) || /\b(help|what can you (do|answer)|capabilit\w+|what (all )?can i ask|examples?)\b/.test(nq)) {
    const g = greeting();
    return { headline: g.headline, sections: [g], followUps: EXAMPLES.slice(0, 4).map(e => e[1]), notes: [] };
  }
  if (/^(thanks|thank you|thx|ok thanks|great|perfect|awesome)\b/.test(nq) && short) {
    const s: Section = { title: "SmartDB Assistant", headline: "You're welcome! Ask me anything else about the data.", blocks: [] };
    return { headline: s.headline, sections: [s], followUps: EXAMPLES.slice(0, 3).map(e => e[1]), notes: [] };
  }
  if (/\b(data as on|as on date|last updated|how (fresh|recent|old)|up to date|when was .* updated|data date|data freshness)\b/.test(nq)) {
    const f = await freshness();
    return { headline: f.headline, sections: [f], followUps: ["Sales last month", "Total unsold units"], notes: [] };
  }

  const c = buildCtx(raw, session.ents.length || session.period ? { ents: session.ents, period: session.period } : null);
  let ids: string[];
  if (/\b(summary|overview|snapshot|at a glance|how are we doing|business status|dashboard summary|key numbers)\b/.test(c.nq)) ids = ["sales", "inventory", "collections"];
  else {
    ids = pick(c);
    if (!ids.length && session.domain && (c.carried.ents || c.carried.period || c.nq.split(" ").length <= 4 || c.ents.length || c.period.explicit)) ids = [session.domain];
  }

  if (!ids.length) {
    const fallback: Section = {
      title: "Not sure yet",
      headline: "I couldn't match that to a dashboard metric yet.",
      blocks: [text("Try naming what you want (sales, inventory, target, collection, budget, PR to PO, cases, loans, footfall, leads…), a project, and a period. For example:"),
        { t: "table", head: ["Area", "Try asking"], rows: EXAMPLES.map(([a, e]) => [a, e]) }],
    };
    return { headline: fallback.headline, sections: [fallback], followUps: EXAMPLES.slice(0, 4).map(e => e[1]), notes: [] };
  }

  const sections: Section[] = [];
  for (const id of ids) {
    const d = DOMAINS.find(x => x.id === id)!;
    if (!d.paths.some(p => canAccess(access, p))) {
      sections.push({ title: d.label, headline: `Your login doesn't have access to ${d.tab}, so I can't share those numbers.`, blocks: [text("Ask your admin if you need this tab enabled.")] });
      continue;
    }
    try { sections.push(await d.run(c)); }
    catch (e) {
      sections.push({ title: d.label, headline: `I hit a problem reading ${d.tab} data.`, blocks: [text(String((e as Error).message || e))] });
    }
  }

  const notes: string[] = [];
  if (c.carried.ents) notes.push(`Used “${entLabel(c.ents)}” from your previous question.`);
  if (c.carried.period) notes.push(`Used “${c.period.label}” from your previous question.`);
  if (!c.ents.length && /\b(this|that|the same|selected|current) project\b/.test(c.nq))
    notes.push("You said “this project” but I don't know which one yet — name it (for example “Sky Arc”) and I'll answer for it. I showed all projects.");
  session = { ents: c.ents, period: c.period.explicit ? c.period : session.period, domain: ids[0] };

  const headline = sections.map(s => s.headline).join("  |  ");
  return { headline, sections, followUps: followUps(ids[0], c), notes };
}
