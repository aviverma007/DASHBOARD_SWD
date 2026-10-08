import clsx, { type ClassValue } from "clsx";

/** shadcn-style class combiner (clsx only — no tailwind-merge in this app). */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
