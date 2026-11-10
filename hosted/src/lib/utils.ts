import { clsx, type ClassValue } from "clsx";

// 26.11.37 classes joined with clsx alone: every Button gets only the site's own classes (auth-primary…), never a
// Tailwind utility that would need tailwind-merge to win a conflict, and dropping it keeps the site within its budget.
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
