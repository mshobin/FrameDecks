import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

// 26.11.37 the two looks and two sizes as plain lookups (class-variance-authority is no longer needed for four strings).
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
const VARIANT = {
  default: "bg-blue-700 text-white hover:bg-blue-800",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
};
const SIZE = { default: "h-10 px-4 py-2", sm: "h-9 rounded-md px-3" };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANT; size?: keyof typeof SIZE };

function Button({ className, size = "default", variant = "default", ...props }: ButtonProps) {
  return <button className={cn(BASE, VARIANT[variant], SIZE[size], className)} {...props} />;
}

export { Button };
