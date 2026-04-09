import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ChunkyVariant =
  | "primary" // green — main CTA
  | "danger" // red — again / destructive
  | "warning" // orange — hard
  | "success" // green — good (alias of primary for grading)
  | "info" // sky blue — easy
  | "neutral"; // gray — secondary

/**
 * Duolingo-style chunky button classes.
 * Base is a rounded pill with a colored underside (box-shadow offset).
 * On :active the button translates down and the shadow collapses, giving
 * the satisfying "press" feel.
 */
export function chunky(variant: ChunkyVariant = "primary", extra = ""): string {
  const base =
    "inline-flex items-center justify-center gap-2 select-none " +
    "rounded-2xl px-6 py-3.5 font-extrabold uppercase tracking-wider text-sm sm:text-base " +
    "transition-transform duration-75 active:translate-y-[3px] " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 " +
    "focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2";

  const variants: Record<ChunkyVariant, string> = {
    primary:
      "bg-green-500 text-white border-b-[5px] border-green-700 hover:bg-green-400 active:border-b-2 focus-visible:ring-green-300",
    success:
      "bg-green-500 text-white border-b-[5px] border-green-700 hover:bg-green-400 active:border-b-2 focus-visible:ring-green-300",
    danger:
      "bg-rose-500 text-white border-b-[5px] border-rose-700 hover:bg-rose-400 active:border-b-2 focus-visible:ring-rose-300",
    warning:
      "bg-amber-400 text-amber-950 border-b-[5px] border-amber-600 hover:bg-amber-300 active:border-b-2 focus-visible:ring-amber-300",
    info:
      "bg-sky-400 text-white border-b-[5px] border-sky-600 hover:bg-sky-300 active:border-b-2 focus-visible:ring-sky-300",
    neutral:
      "bg-white text-gray-700 border-2 border-b-[5px] border-gray-300 hover:bg-gray-50 active:border-b-2 focus-visible:ring-gray-300",
  };

  return `${base} ${variants[variant]} ${extra}`.trim();
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChunkyVariant;
  children: ReactNode;
}

export function Button({ variant = "primary", className = "", children, ...rest }: Props) {
  return (
    <button className={chunky(variant, className)} {...rest}>
      {children}
    </button>
  );
}
