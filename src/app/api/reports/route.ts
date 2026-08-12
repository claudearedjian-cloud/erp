import { NextResponse } from "next/server";
import { db } from "@/db";
import { reports, orders, machines, orderOperations, customers, inventoryItems, users } from "@/db/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { authorize } from "@/lib/auth";

export async function GET(request: Request) {
  const { error: authError } = await authorize("reports:read");
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get("reportId");
    const type = url.searchParams.get("type");

    if (reportId) {
      const [report] = await db.select().from(reports).where(eq(reports.id, Number(reportId)));
      if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      return NextResponse.json(report);
    }

    // List saved reports
    let savedReports = await db.select().from(reports).orderBy(desc(reports.createdAt));
    if (type) {
      savedReports = savedReports.filter(r => r.type === type);
    }
    return NextResponse.json(savedReports);
  } catch (error: any) {
    console.error("GET reports error:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch reports" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error: authError } = await authorize("reports:write");
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, type, dateFrom, dateTo, filters = {}, generatedBy } = body;

    if (!name || !type || !dateFrom || !dateTo) {
      return NextResponse.json({ error: "Name, type, date range are required." }, { status: 400 });
    }

    // Generate report data based on type
    let reportData: any = {};

    if (type === "Production Summary") {
      const allOrders = await db.select().from(orders);
      const dateFromObj = new Date(dateFrom);
      const dateToObj = new Date(dateTo);
      const filteredOrders = allOrders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= dateFromObj && orderDate <= dateToObj;
      });
      reportData = {
        totalOrders: filteredOrders.length,
        completedOrders: filteredOrders.filter(o => o.status === "Completed").length,
        inProductionOrders: filteredOrders.filter(o => o.status === "In Production").length,
        pendingOrders: filteredOrders.filter(o => o.status === "Pending").length,
        totalValue: filteredOrders.reduce((sum, o) => sum + parseFloat(o.totalValue || "0"), 0),
        orders: filteredOrders.map(o => ({
          orderNumber: o.orderNumber,
          title: o.title,
          status: o.status,
          totalValue: o.totalValue,
          createdAt: o.createdAt,
        })),
      };
    } else if (type === "Machine Utilization") {
      const allMachines = await db.select().from(machines);
      const allOps = await db.select().from(orderOperations);
      reportData = {
        machines: allMachines.map(m => {
          const machineOps = allOps.filter(o => o.machineId === m.id);
          const completedOps = machineOps.filter(o => o.status === "Completed");
          const totalMinutes = completedOps.reduce((sum, o) => sum + (o.actualMinutes || o.estimatedMinutes || 0), 0);
          return {
            machineCode: m.code,
            machineName: m.name,
            category: m.category,
            totalOperations: machineOps.length,
            completedOperations: completedOps.length,
            totalMinutes: Math.round(totalMinutes),
            totalHours: Math.round((totalMinutes / 60) * 10) / 10,
            status: m.status,
          };
        }),
      };
    } else if (type === "Order Status") {
      const allOrders = await db.select().from(orders);
      const allOps = await db.select().from(orderOperations);
      reportData = {
        byStatus: {
          Pending: allOrders.filter(o => o.status === "Pending").length,
          InProduction: allOrders.filter(o => o.status === "In Production").length,
          QualityReview: allOrders.filter(o => o.status === "Quality Review").length,
          Completed: allOrders.filter(o => o.status === "Completed").length,
          OnHold: allOrders.filter(o => o.status === "On Hold").length,
        },
        orders: allOrders.map(o => ({
          orderNumber: o.orderNumber,
          title: o.title,
          status: o.status,
          progressPercent: o.progressPercent,
          dueDate: o.dueDate,
          totalValue: o.totalValue,
        })),
      };
    } else if (type === "Inventory Status") {
      const allInventory = await db.select().from(inventoryItems);
      reportData = {
        totalItems: allInventory.length,
        lowStockItems: allInventory.filter(i => i.stockQuantity <= i.reorderLevel).length,
        totalValue: allInventory.reduce((sum, i) => sum + (i.stockQuantity * parseFloat(i.unitCost || "0")), 0),
        items: allInventory.map(i => ({
          sku: i.sku,
          name: i.name,
          category: i.category,
          stockQuantity: i.stockQuantity,
          unit: i.unit,
          unitCost: i.unitCost,
          totalValue: (i.stockQuantity * parseFloat(i.unitCost || "0")).toFixed(2),
          reorderLevel: i.reorderLevel,
          isLowStock: i.stockQuantity <= i.reorderLevel,
        })),
      };
    } else if (type === "Client Activity") {
      const allCustomers = await db.select().from(customers);
      const allOrders = await db.select().from(orders);
      reportData = {
        clients: allCustomers.map(c => {
          const custOrders = allOrders.filter(o => o.customerId === c.id);
          return {
            company: c.company,
            contactName: c.name,
            email: c.email,
            phone: c.phone,
            totalOrders: custOrders.length,
            activeOrders: custOrders.filter(o => o.status !== "Completed" && o.status !== "On Hold").length,
            totalSpend: custOrders.reduce((sum, o) => sum + parseFloat(o.totalValue || "0"), 0),
            creditLimit: c.creditLimit,
            currentBalance: c.currentBalance,
          };
        }),
      };
    } else if (type === "Operator Performance") {
      const allUsers = await db.select().from(users).where(eq(users.role, "Machine Operator"));
      const allOps = await db.select().from(orderOperations);
      reportData = {
        operators: allUsers.map(u => {
          const operatorOps = allOps.filter(o => o.operatorId === u.id && o.status === "Completed");
          const totalMinutes = operatorOps.reduce((sum, o) => sum + (o.actualMinutes || o.estimatedMinutes || 0), 0);
          return {
            name: u.name,
            role: u.role,
            completedOperations: operatorOps.length,
            totalMinutes: Math.round(totalMinutes),
            totalHours: Math.round((totalMinutes / 60) * 10) / 10,
            avgEfficiency: operatorOps.length > 0 
              ? Math.round((operatorOps.reduce((sum, o) => sum + ((o.estimatedMinutes || 0) / Math.max(o.actualMinutes || 1, 1)), 0) / operatorOps.length) * 100)
              : 0,
          };
        }),
      };
    }

    // Save report to database
    const [newReport] = await db.insert(reports).values({
      name,
      type,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      filtersJson: filters,
      dataJson: reportData,
      generatedBy: generatedBy ? Number(generatedBy) : null,
    }).returning();

    return NextResponse.json({ ...newReport, data: reportData }, { status: 201 });
  } catch (error: any) {
    console.error("POST report error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate report" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { error: authError } = await authorize("reports:write");
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get("reportId");
    if (!reportId) {
      return NextResponse.json({ error: "Report ID required" }, { status: 400 });
    }
    await db.delete(reports).where(eq(reports.id, Number(reportId)));
    return NextResponse.json({ success: true, message: "Report deleted" });
  } catch (error: any) {
    console.error("DELETE report error:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete report" }, { status: 500 });
  }
}
