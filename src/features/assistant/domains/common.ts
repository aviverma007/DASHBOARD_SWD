import type { Block, Ctx, Section } from "../types";
import { entLabel, fN } from "../nlp";

export const rowsOf = (head: string[], rows: string[][], note?: string): Block => ({ t: "table", head, rows, note });
export const kv = (rows: [string, string][]): Block => ({ t: "kv", rows });
export const text = (t: string): Block => ({ t: "text", text: t });

export function sectionTitle(base: string, c: Ctx, withPeriod = true) {
  const parts = [base];
  if (c.ents.length) parts.push(entLabel(c.ents));
  if (withPeriod && c.period.explicit) parts.push(c.period.label);
  return parts.join(" · ");
}

/** Nothing in this dataset matches the project(s) the user named. */
export function noProject(title: string, c: Ctx, tab: string, path: string, asOn?: string): Section {
  return {
    title,
    headline: `No ${tab} data found for ${entLabel(c.ents)}.`,
    blocks: [text(`The ${tab} tab has no rows for ${entLabel(c.ents)}. Try another project name, or ask without a project to see all of them.`)],
    asOn, open: { label: `Open ${tab}`, path },
  };
}

/** Top-N helper that keeps a count of what was cut. */
export function topRows<T>(arr: T[], n: number): { shown: T[]; more: number } {
  return { shown: arr.slice(0, n), more: Math.max(0, arr.length - n) };
}
export const moreNote = (more: number, what: string) => (more > 0 ? `+ ${fN(more)} more ${what} not shown` : undefined);

export function barBlock(title: string, items: { label: string; value: number; text: string }[]): Block {
  return { t: "bars", title, rows: items };
}
