import React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export const controlClassName =
  "w-full rounded-lg border border-[color:var(--cs-border)] bg-white px-3 py-2 text-sm text-[color:var(--cs-ink)] outline-none transition placeholder:text-[color:var(--cs-muted-2)] focus:border-[color:var(--cs-primary)] focus:ring-2 focus:ring-[rgba(0,119,182,0.16)] disabled:cursor-not-allowed disabled:bg-[#f6fafc] disabled:text-[color:var(--cs-muted)]";

export const textareaClassName = cn(controlClassName, "min-h-16 resize-y");

export function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-[color:var(--cs-muted)]">
        {label}
        {required && <span className="text-[color:var(--cs-danger)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
