import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "bronze";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-colors duration-150 " +
  "disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap";
const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:opacity-90 border border-transparent",
  secondary: "bg-transparent text-ink border border-line hover:border-accent hover:bg-surface-2",
  ghost: "bg-transparent text-ink hover:bg-surface-2 border border-transparent",
  danger: "bg-cond-critical text-white hover:opacity-90 border border-transparent",
  bronze: "bg-bronze text-navy hover:opacity-90 border border-transparent",
};
const sizes: Record<ButtonSize, string> = {
  sm: "text-sm px-3 min-h-[36px]",
  md: "text-[0.95rem] px-4 min-h-[44px]",
  lg: "text-base px-5 min-h-[50px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={buttonClass(variant, size, className)} {...props} />;
}
