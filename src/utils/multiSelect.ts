/** One behaviour for every "All projects" style checkbox dropdown.
 *
 *  Selection model (unchanged for every page's filter code):
 *    []        = All     → every box ticked, nothing filtered
 *    [NONE]    = nothing → no box ticked, everything filtered out
 *    [a, b, …] = those items only
 *
 *  - "All" ticked + click "All"      → untick everything
 *  - "All" not ticked + click "All"  → tick everything
 *  - all ticked + click one item     → every item except that one
 *  - ticking the last missing item   → back to All
 *  - unticking the last ticked item  → nothing
 *  Filters written as `sel.length && !sel.includes(x)` need no change: the
 *  sentinel never matches a real item, so "nothing" shows no rows. */
export const NONE_STR = "\u0000none";
export const NONE_NUM = -987654;

export const msIsNone = <T,>(sel: readonly T[], none: T) => sel.length === 1 && sel[0] === none;
export const msAllOn = <T,>(sel: readonly T[]) => sel.length === 0;
export const msItemOn = <T,>(sel: readonly T[], x: T) => sel.length === 0 || sel.includes(x);
export const msAllClick = <T,>(sel: readonly T[], none: T): T[] => (sel.length === 0 ? [none] : []);
export function msToggle<T>(sel: readonly T[], x: T, all: readonly T[], none: T): T[] {
  const base = sel.length === 0 ? [...all] : sel.filter(a => a !== none);
  const next = base.includes(x) ? base.filter(a => a !== x) : [...base, x];
  return next.length === 0 ? [none] : next.length >= all.length && all.every(a => next.includes(a)) ? [] : next;
}

/* Set-based dropdowns: same rules */
export const msSetItemOn = <T,>(sel: ReadonlySet<T>, x: T) => sel.size === 0 || sel.has(x);
export const msSetAllClick = <T,>(sel: ReadonlySet<T>, none: T): Set<T> => (sel.size === 0 ? new Set([none]) : new Set());
export const msSetToggle = <T,>(sel: ReadonlySet<T>, x: T, all: readonly T[], none: T): Set<T> =>
  new Set(msToggle([...sel], x, all, none));
export const msSetIsNone = <T,>(sel: ReadonlySet<T>, none: T) => sel.size === 1 && sel.has(none);
