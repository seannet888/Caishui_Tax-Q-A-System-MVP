// lib/utils/date.ts
// 财税时效性日期工具。
import dayjs from "dayjs";

export function isExpired(expireDate?: string | null, at: Date = new Date()): boolean {
  if (!expireDate) return false;
  return dayjs(expireDate).isBefore(dayjs(at));
}

export function isEffective(
  effectiveDate?: string | null,
  at: Date = new Date(),
): boolean {
  if (!effectiveDate) return true;
  return !dayjs(effectiveDate).isAfter(dayjs(at));
}

export function daysUntilExpiry(
  expireDate?: string | null,
  at: Date = new Date(),
): number | null {
  if (!expireDate) return null;
  return dayjs(expireDate).diff(dayjs(at), "day");
}

export function formatDate(date?: string | Date | null): string {
  if (!date) return "未知";
  return dayjs(date).format("YYYY-MM-DD");
}
