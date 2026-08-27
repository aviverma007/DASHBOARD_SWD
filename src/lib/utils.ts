/** Minimal class-name joiner (shadcn convention). We don't need
 * clsx/tailwind-merge for our usage — falsy values are dropped. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
