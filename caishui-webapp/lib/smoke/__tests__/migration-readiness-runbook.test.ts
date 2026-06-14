import { describe, expect, it } from "vitest";
import {
  formatMigrationReadinessRunbook,
  getMigrationReadinessRunbook,
} from "@/lib/smoke/migration-readiness-runbook";

describe("getMigrationReadinessRunbook", () => {
  it("separates offline migration contract checks from live drift checks", () => {
    const runbook = getMigrationReadinessRunbook({
      DATABASE_URL: "postgresql://local",
      SHADOW_DATABASE_URL: "postgresql://shadow",
    });

    expect(runbook.steps.map((step) => step.command)).toEqual([
      "pnpm vitest run prisma/__tests__/migration-contract.test.ts",
      "pnpm prisma migrate status",
      "pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url $env:SHADOW_DATABASE_URL",
      "pnpm prisma migrate deploy",
    ]);
    expect(runbook.steps.at(0)?.mode).toBe("offline");
    expect(runbook.steps.slice(1).every((step) => step.mode === "live-db")).toBe(
      true,
    );
  });
});

describe("formatMigrationReadinessRunbook", () => {
  it("prints missing database environment and the single-DDL-owner warning", () => {
    const text = formatMigrationReadinessRunbook(
      getMigrationReadinessRunbook({}),
    );

    expect(text).toContain("Migration readiness runbook");
    expect(text).toContain("Missing env: DATABASE_URL");
    expect(text).toContain("Missing env: SHADOW_DATABASE_URL");
    expect(text).toContain("Single DDL owner: Prisma migrations only; no Alembic/create_all");
  });
});
