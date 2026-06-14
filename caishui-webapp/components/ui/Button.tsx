import React from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "ghost";
type ButtonSize = "sm" | "md";

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--cs-primary-dark)] text-white shadow-[0_4px_12px_rgba(0,107,166,0.18)] hover:bg-[color:var(--cs-primary-hover)] focus:ring-[color:var(--cs-primary)] focus:ring-offset-2 disabled:bg-[#9db9ca] disabled:shadow-none",
  secondary:
    "border border-[color:var(--cs-border)] bg-white text-[color:var(--cs-primary)] hover:border-[color:var(--cs-primary)] focus:ring-[color:var(--cs-primary)]",
  success:
    "bg-[#1f8a5b] text-white hover:brightness-95 focus:ring-[#1f8a5b]",
  warning:
    "bg-[color:var(--cs-warning)] text-white hover:brightness-95 focus:ring-[color:var(--cs-warning)]",
  danger:
    "bg-[color:var(--cs-danger)] text-white hover:brightness-95 focus:ring-[color:var(--cs-danger)]",
  ghost:
    "text-[color:var(--cs-primary)] hover:bg-[color:var(--cs-primary-soft)] focus:ring-[color:var(--cs-primary)]",
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-55",
        variantClassName[variant],
        sizeClassName[size],
        className,
      )}
      {...props}
    />
  );
}
