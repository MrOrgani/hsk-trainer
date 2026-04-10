import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ChunkyVariant =
  | "primary" // vermillion — main CTA
  | "danger" // vermillion — again / destructive
  | "warning" // gold — hard
  | "success" // jade — good
  | "info" // jade lighter — easy
  | "neutral"; // ink/paper — secondary

/**
 * Ink & Jade button system. Soft rounded buttons with a subtle 3D press feel
 * using box-shadow instead of hard borders. Chinese-inspired color palette.
 */
export function chunky(variant: ChunkyVariant = "primary", extra = ""): string {
  const base =
    "inline-flex items-center justify-center gap-2 select-none " +
    "rounded-xl px-6 py-3.5 font-bold text-sm sm:text-base " +
    "transition-all duration-100 " +
    "active:translate-y-[2px] active:shadow-press " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 " +
    "focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

  const variants: Record<ChunkyVariant, string> = {
    primary:
      "bg-vermillion-500 text-white shadow-[0_4px_0_0_#8c1f2e] hover:bg-vermillion-400 active:shadow-none focus-visible:ring-vermillion-300",
    success:
      "bg-jade-500 text-white shadow-[0_4px_0_0_#07624f] hover:bg-jade-400 active:shadow-none focus-visible:ring-jade-300",
    danger:
      "bg-vermillion-600 text-white shadow-[0_4px_0_0_#6b1823] hover:bg-vermillion-500 active:shadow-none focus-visible:ring-vermillion-300",
    warning:
      "bg-gold-500 text-white shadow-[0_4px_0_0_#875412] hover:bg-gold-400 active:shadow-none focus-visible:ring-gold-300",
    info:
      "bg-jade-400 text-white shadow-[0_4px_0_0_#097a61] hover:bg-jade-300 active:shadow-none focus-visible:ring-jade-300",
    neutral:
      "bg-paper text-ink-700 shadow-[0_4px_0_0_#d6cdbf] border border-ink-200 hover:bg-ink-50 active:shadow-none focus-visible:ring-ink-300",
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
