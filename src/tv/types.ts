/** TV preview — data contract. Each department module builds a TvDept from
 *  the SAME datasets/logic the dashboard pages use (no new numbers). */
export type Tone = "navy" | "green" | "teal" | "amber" | "red" | "violet" | "gold";

export interface TvKpi {
  id: string;                       // stable id — the card morphs between scenes by id
  label: string;                    // short, e.g. "Total sales value"
  value: number;                    // raw number (animated count-up)
  format: (n: number) => string;    // e.g. inrCr, fN, v => v.toFixed(0)+"%"
  sub?: string;                     // one short line under the value
  tone: Tone;
}

export type Visual =
  | { type: "columns"; title: string; data: { label: string; value: number; value2?: number }[]; format: (n: number) => string; legend?: [string, string] }
  | { type: "hbars"; title: string; rows: { label: string; value: number; sub?: string }[]; format: (n: number) => string }
  | { type: "donut"; title: string; parts: { label: string; value: number; color?: string }[]; centre: { value: string; label: string }; format: (n: number) => string }
  | { type: "ring"; title: string; pct: number; label: string; sub?: string };

export interface TvStory {
  focus: string;                    // TvKpi.id spotlighted in this scene
  headline: string;                 // the one-sentence takeaway the boss reads (no invented numbers)
  detail?: string;
  visual: Visual;
}

export interface TvDept {
  id: string;
  name: string;
  tagline: string;
  asOn: string;                     // "05 Oct 2026" or "live · synced …"
  live?: boolean;
  kpis: TvKpi[];                    // 4–6 headline KPIs
  stories: TvStory[];               // 4–6 spotlight scenes
}

export interface TvDeptDef {
  id: string;
  name: string;
  tagline: string;
  pages: string;                    // "Bookings · Target · EOI" shown on the picker tile
  icon: string;                     // lucide icon name
  tone: Tone;
  load: () => Promise<TvDept>;      // dynamic import inside, so heavy JSON loads only when chosen
}

export const TONE: Record<Tone, [string, string]> = {
  navy: ["#22397a", "#12204a"],
  green: ["#1d9a6c", "#0f6a49"],
  teal: ["#1b8aa6", "#0b4f66"],
  amber: ["#c9923a", "#8f5d10"],
  red: ["#b8362a", "#7d1f14"],
  violet: ["#7c4fb8", "#46277d"],
  gold: ["#b98a3e", "#8a6420"],
};
