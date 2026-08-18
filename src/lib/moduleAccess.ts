// src/lib/moduleAccess.ts
// ============================================================================
// Per-role visibility for top-level modules.
//
// A "module" corresponds to one sidebar tab. The Sidebar component reads
// this map to decide which tabs to render, and the page-level guard uses
// it to redirect a user who manually types an unreachable URL.
// ============================================================================

import type { Role } from "@/lib/dataAccess";

export type ModuleId =
  | "dashboard"
  | "orders"
  | "machines"
  | "operator"
  | "customers"
  | "inventory"
  | "schedule"
  | "gantt"
  | "cmms"
  | "reports"
  | "settings"
  | "workforce"
  | "wip"
  | "quality"
  | "downtime";

/**
 * Every module a role is allowed to access. Manager sees all. Other roles
 * see only the modules they need for their day-to-day work.
 */
export const MODULES_BY_ROLE: Record<Role, ModuleId[]> = {
  Manager: [
    "dashboard",
    "orders",
    "machines",
    "operator",
    "customers",
    "inventory",
    "schedule",
    "gantt",
    "cmms",
    "reports",
    "settings",
    "workforce",
    "wip",
    "quality",
    "downtime",
  ],
  "Sales Coordinator": [
    "dashboard",
    "orders",
    "customers",
    "schedule",
    "reports",
    "wip",
  ],
  "Machine Operator": [
    "dashboard",
    "orders",
    "operator",
    "inventory",
    "workforce",
    "wip",
    "quality",
    "downtime",
  ],
  "QA & Dispatch": [
    "dashboard",
    "orders",
    "machines",
    "inventory",
    "cmms",
    "workforce",
    "wip",
    "quality",
    "downtime",
  ],
  Technician: [
    "dashboard",
    "machines",
    "operator",
    "cmms",
    "workforce",
    "wip",
    "downtime",
  ],
};

export function canAccessModule(role: Role | string | null | undefined, module: ModuleId): boolean {
  if (!role) return false;
  const modules = (MODULES_BY_ROLE as Record<string, ModuleId[]>)[role] ?? [];
  return modules.includes(module);
}

export function listModulesForRole(role: Role | string | null | undefined): ModuleId[] {
  if (!role) return [];
  return (MODULES_BY_ROLE as Record<string, ModuleId[]>)[role] ?? [];
}
