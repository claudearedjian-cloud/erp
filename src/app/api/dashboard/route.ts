import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, machines, orderOperations, inventoryItems, customers, users } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { authorize } from "@/lib/auth";
import {
  listOrdersForUser,
  listMachinesForUser,
  listOperationsForUser,
  listCustomersForUser,
  isManager as userIsManager,
} from "@/lib/dataAccess";

export async function GET() {
  const { user, error: authError } = await authorize();
  if (authError || !user) return authError ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [orderRows, machineRows, opRows, invRows, customerRows] = await Promise.all([
      listOrdersForUser(user),
      listMachinesForUser(user),
      listOperationsForUser(user),
      db.select().from(inventoryItems),
      listCustomersForUser(user),
    ]);

    // Order KPIs
    const activeStatuses = new Set(["In Production", "Pending", "Quality Review"]);
    const activeOrders = orderRows.filter(o => activeStatuses.has(o.status));
    const totalPipelineValue = activeOrders.reduce(
      (s, o) => s + (o.totalValue ? parseFloat(o.totalValue) : 0),
      0,
    );
    const urgentOrdersCount = activeOrders.filter(o => o.priority === "Urgent" || o.priority === "High").length;
    const completedThisMonth = orderRows.filter(o => o.status === "Completed").length;

    // Machine Utilization & Bottleneck Analysis
    const totalMachines = machineRows.length;
    const inUseMachines = machineRows.filter(m => {
      const activeJob = opRows.find(o => o.machineId === m.id && o.status === "In Progress");
      return activeJob || m.status === "In-Use";
    }).length;

    const maintenanceMachines = machineRows.filter(m => m.status === "Maintenance" || m.status === "Offline").length;
    const utilizationRate = totalMachines > 0 ? Math.round((inUseMachines / totalMachines) * 100) : 0;

    // Bottlenecks: Find machines with highest number of "Ready" or "In Progress" steps
    const machineWorkloads = machineRows.map(m => {
      const queue = opRows.filter(o => o.machineId === m.id && (o.status === "Ready" || o.status === "In Progress"));
      const totalMinutes = queue.reduce((s, o) => s + (o.estimatedMinutes || 0), 0);
      return {
        machineId: m.id,
        name: m.name,
        code: m.code,
        category: m.category,
        status: m.status,
        queueLength: queue.length,
        estimatedHours: Math.round((totalMinutes / 60) * 10) / 10,
        hourlyCost: userIsManager(user) ? m.hourlyCost : null,
      };
    }).sort((a, b) => b.queueLength - a.queueLength);

    const primaryBottleneck = machineWorkloads.find(m => m.queueLength > 0) || null;

    // Inventory Alerts
    const lowStockItems = invRows.filter(i => i.stockQuantity <= i.reorderLevel);

    // Recent Operational Activity
    const activeShopJobs = opRows.filter(o => o.status === "In Progress" || o.status === "Ready").slice(0, 6);

    return NextResponse.json({
      kpis: {
        activeOrdersCount: activeOrders.length,
        totalPipelineValue: userIsManager(user) ? totalPipelineValue.toFixed(2) : "—",
        urgentOrdersCount,
        completedOrdersCount: completedThisMonth,
        utilizationRate,
        inUseMachines,
        totalMachines,
        maintenanceMachines,
        customerCount: customerRows.length,
        inventoryAlertsCount: lowStockItems.length,
      },
      machineWorkloads,
      primaryBottleneck,
      lowStockItems: lowStockItems.slice(0, 5),
      activeShopJobs,
      orderStatusDistribution: {
        Pending: orderRows.filter(o => o.status === "Pending").length,
        InProduction: orderRows.filter(o => o.status === "In Production").length,
        QualityReview: orderRows.filter(o => o.status === "Quality Review").length,
        Completed: orderRows.filter(o => o.status === "Completed").length,
        OnHold: orderRows.filter(o => o.status === "On Hold").length,
      },
    });
  } catch (error: any) {
    console.error("GET dashboard metrics error:", error);
    return NextResponse.json({ error: error?.message || "Failed to compute dashboard metrics" }, { status: 500 });
  }
}
