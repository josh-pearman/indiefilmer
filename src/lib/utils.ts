import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date value (string or Date) as a local date, avoiding the UTC
 * midnight shift that causes off-by-one day errors with `new Date("YYYY-MM-DD")`.
 */
export function localDate(value: string | Date): Date {
  const str = value instanceof Date ? value.toISOString() : value;
  return new Date(str.slice(0, 10) + "T00:00:00");
}

