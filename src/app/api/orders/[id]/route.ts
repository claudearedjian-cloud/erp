import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, customers, orderOperations, orderMaterials, machines, users, inventoryItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { authorize } from "@/lib/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error: authError } = await authorize("orders:read");
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const orderId = Number(id);

    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        title: orders.title,
        projectType: orders.projectType,
        priority: orders.priority,
        status: orders.status,
        totalValue: orders.totalValue,
        dueDate: orders.dueDate,
        progressPercent: orders.progressPercent,
        notes: orders.notes,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
        customerName: customers.name,
        customerCompany: customers.company,
        customerEmail: customers.email,
        customerPhone: customers.phone,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, orderId));

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const ops = await db
      .select({
        id: orderOperations.id,
        stepOrder: orderOperations.stepOrder,
        operationName: orderOperations.operationName,
        estimatedMinutes: orderOperations.estimatedMinutes,
        actualMinutes: orderOperations.actualMinutes,
        status: orderOperations.status,
        machineId: orderOperations.machineId,
        machineName: machines.name,
        machineCode: machines.code,
        machineCategory: machines.category,
        operatorId: orderOperations.operatorId,
        operatorName: users.name,
        operatorAvatar: users.avatarColor,
        startTime: orderOperations.startTime,
        endTime: orderOperations.endTime,
        scheduledStart: orderOperations.scheduledStart,
        scheduledEnd: orderOperations.scheduledEnd,
        qualityNotes: orderOperations.qualityNotes,
        rejectReason: orderOperations.rejectReason,
      })
      .from(orderOperations)
      .leftJoin(machines, eq(orderOperations.machineId, machines.id))
      .leftJoin(users, eq(orderOperations.operatorId, users.id))
      .where(eq(orderOperations.orderId, orderId))
      .orderBy(asc(orderOperations.stepOrder));

    const mats = await db
      .select({
        id: orderMaterials.id,
        itemId: orderMaterials.itemId,
        itemName: inventoryItems.name,
        itemSku: inventoryItems.sku,
        itemUnit: inventoryItems.unit,
        quantityUsed: orderMaterials.quantityUsed,
        costPerUnit: orderMaterials.costPerUnit,
      })
      .from(orderMaterials)
      .leftJoin(inventoryItems, eq(orderMaterials.itemId, inventoryItems.id))
      .where(eq(orderMaterials.orderId, orderId));

    return NextResponse.json({
      ...order,
      operations: ops,
      materials: mats,
    });
  } catch (error: any) {
    console.error("GET order details error:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch order details" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error: authError } = await authorize("orders:edit");
  if (authError || !user) return authError ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const orderId = Number(id);
    const body = await request.json();

    // Sales can only edit orders they own
    if (user.role === "Sales Coordinator") {
      const [owned] = await db
        .select({ createdById: orders.createdById, assignedSalesId: orders.assignedSalesId })
        .from(orders)
        .where(eq(orders.id, orderId));
      if (!owned) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (owned.createdById !== user.id && owned.assignedSalesId !== user.id) {
        return NextResponse.json(
          { error: "You can only edit orders assigned to you." },
          { status: 403 },
        );
      }
    }

    // Operators, QA, Technicians: NOT allowed to edit order metadata at all
    // (only the order:edit gate above would let Sales/Manager through)

    const updateFields: any = {};
    if (body.title !== undefined) updateFields.title = body.title;
    if (body.projectType !== undefined) updateFields.projectType = body.projectType;
    if (body.priority !== undefined) updateFields.priority = body.priority;
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.totalValue !== undefined) updateFields.totalValue = String(body.totalValue);
    if (body.dueDate !== undefined) updateFields.dueDate = new Date(body.dueDate);
    if (body.progressPercent !== undefined) updateFields.progressPercent = Number(body.progressPercent);
    if (body.notes !== undefined) updateFields.notes = body.notes;

    const [updatedOrder] = await db
      .update(orders)
      .set(updateFields)
      .where(eq(orders.id, orderId))
      .returning();

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error("PATCH order error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error: authError } = await authorize("orders:delete");
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const orderId = Number(id);

    // Delete related records first due to constraints
    await db.delete(orderMaterials).where(eq(orderMaterials.orderId, orderId));
    await db.delete(orderOperations).where(eq(orderOperations.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));

    return NextResponse.json({ success: true, message: "Order and workflow operations deleted." });
  } catch (error: any) {
    console.error("DELETE order error:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete order" }, { status: 500 });
  }
}
