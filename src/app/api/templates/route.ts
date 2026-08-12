import { NextResponse } from "next/server";
import { db } from "@/db";
import { operationTemplates } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { authorize } from "@/lib/auth";

export async function GET() {
  const { error: authError } = await authorize();
  if (authError) return authError;

  try {
    const tpls = await db.select().from(operationTemplates).orderBy(asc(operationTemplates.name));
    return NextResponse.json(tpls);
  } catch (error: any) {
    console.error("GET templates error:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch operation templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error: authError } = await authorize("orders:write");
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, description, defaultStepsJson } = body;

    if (!name || !defaultStepsJson || !Array.isArray(defaultStepsJson)) {
      return NextResponse.json({ error: "Name and steps array are required." }, { status: 400 });
    }

    const [newTpl] = await db.insert(operationTemplates).values({
      name,
      description: description || "Custom workflow routing",
      defaultStepsJson
    }).returning();

    return NextResponse.json(newTpl, { status: 201 });
  } catch (error: any) {
    console.error("POST template error:", error);
    return NextResponse.json({ error: error?.message || "Failed to create template" }, { status: 500 });
  }
}
