import React from "react";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";

const TONES: Record<string, StatusTone> = {
  PENDING: "neutral",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "danger",
  RETRIEVABLE: "success",
  WITHDRAWN: "warning",
  verified: "success",
  unverified: "neutral",
  rejected: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <StatusPill tone={TONES[status] ?? "neutral"}>{status}</StatusPill>;
}
