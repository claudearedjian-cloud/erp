import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderMaterials, inventoryItems, orders } from "@/db/schema";
import { authorize } from "@/lib/auth";

/**
 * Bill-of-materials allocation. Every write runs inside a single transaction
 * so a race between two operators can never oversell the same sheet of MDF.
 * The invariant: stock delta on `inventory_items` and quantity change on
 * `order_materials` either both commit or neither does.
 */

async function loadOrderMaterials(orderId: number) {
  return db
    .select({
      id: orderMaterials.id,
      itemId: orderMaterials.itemId,
      itemName: inventoryItems.name,
      itemSku: inventoryItems.sku,
      itemUnit: inventoryItems.unit,
      itemCategory: inventoryItems.category,
      itemStockRemaining: inventoryItems.stockQuantity,
      itemReorderLevel: inventoryItems.reorderLevel,
      quantityUsed: orderMaterials.quantityUsed,
      costPerUnit: orderMaterials.costPerUnit,
    })
    .from(orderMaterials)
    .leftJoin(inventoryItems, eq(orderMaterials.itemId, inventoryItems.id))
    .where(eq(orderMaterials.orderId, orderId));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error } = await authorize("orders:read");
  if (error) return error;
  try {
    const { id } = await context.params;
    return NextResponse.json(await loadOrderMaterials(Number(id)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch BOM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // Allocating stock to an order is a planning/management task - Manager or Sales only.
  const { error } = await authorize("materials:write");
  if (error) return error;

  try {
    const { id } = await context.params;
    const orderId = Number(id);
    const body = await request.json();
    const itemId = Number(body.itemId);
    const quantity = Math.floor(Number(body.quantityUsed));

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Please choose a stock item." }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Enter a positive whole quantity." }, { status: 400 });
    }

    const [orderRow] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId));
    if (!orderRow) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    // Single atomic transaction — either the stock moves AND the BOM row updates, or nothing does.
    await db.transaction(async (tx) => {
      const [item] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, itemId));
      if (!item) throw Object.assign(new Error("Stock item not found."), { httpStatus: 404 });

      const [existing] = await tx
        .select()
        .from(orderMaterials)
        .where(and(eq(orderMaterials.orderId, orderId), eq(orderMaterials.itemId, itemId)));

      // `delta` = additional units to pull from the warehouse (negative = return to stock).
      const delta = existing ? quantity - existing.quantityUsed : quantity;

      if (delta > 0 && item.stockQuantity < delta) {
        throw Object.assign(
          new Error(
            `Only ${item.stockQuantity} ${item.unit} of ${item.sku} in stock — cannot allocate ${quantity}. ` +
              (existing ? `Already reserved to this order: ${existing.quantityUsed}.` : ""),
          ),
          { httpStatus: 409 },
        );
      }

      if (existing) {
        await tx
          .update(orderMaterials)
          .set({ quantityUsed: quantity, costPerUnit: item.unitCost })
          .where(eq(orderMaterials.id, existing.id));
      } else {
        await tx.insert(orderMaterials).values({
          orderId,
          itemId,
          quantityUsed: quantity,
          costPerUnit: item.unitCost,
        });
      }

      if (delta !== 0) {
        await tx
          .update(inventoryItems)
          .set({ stockQuantity: item.stockQuantity - delta })
          .where(eq(inventoryItems.id, itemId));
      }
    });

    return NextResponse.json({ success: true, materials: await loadOrderMaterials(orderId) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to allocate material";
    const status = (err as { httpStatus?: number })?.httpStatus ?? 500;
    if (status >= 500) console.error("POST material allocation error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error } = await authorize("materials:write");
  if (error) return error;

  try {
    const { id } = await context.params;
    const orderId = Number(id);
    const url = new URL(request.url);
    const allocationId = Number(url.searchParams.get("allocationId"));

    if (!Number.isInteger(allocationId) || allocationId <= 0) {
      return NextResponse.json({ error: "Allocation ID is required." }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      const [allocation] = await tx
        .select()
        .from(orderMaterials)
        .where(and(eq(orderMaterials.orderId, orderId), eq(orderMaterials.id, allocationId)));
      if (!allocation) throw Object.assign(new Error("Allocation not found on this order."), { httpStatus: 404 });

      const [item] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, allocation.itemId));
      if (item) {
        await tx
          .update(inventoryItems)
          .set({ stockQuantity: item.stockQuantity + allocation.quantityUsed })
          .where(eq(inventoryItems.id, item.id));
      }
      await tx.delete(orderMaterials).where(eq(orderMaterials.id, allocationId));
    });

    return NextResponse.json({ success: true, materials: await loadOrderMaterials(orderId) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to release material";
    const status = (err as { httpStatus?: number })?.httpStatus ?? 500;
    if (status >= 500) console.error("DELETE material allocation error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
