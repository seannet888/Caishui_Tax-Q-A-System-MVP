import React from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClassName: Record<StatusTone, string> = {
  neutral: "bg-[#edf4f9] text-[color:var(--cs-muted)]",
  info: "bg-[#e4f3fb] text-[color:var(--cs-primary)]",
  success: "bg-[color:var(--cs-success-bg)] text-[#1f8a5b]",
  warning: "bg-[color:var(--cs-warning-bg)] text-[color:var(--cs-warning)]",
  danger: "bg-[color:var(--cs-danger-bg)] text-[color:var(--cs-danger)]",
};

export type StatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

export function StatusPill({
  tone = "neutral",
  className,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn("rounded px-2 py-0.5 text-xs", toneClassName[tone], className)}
      {...props}
    />
  );
}
