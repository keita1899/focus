import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const fixedCostsKey = "fixed-costs-v1";

export async function PUT(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const value = await request.json();
  const key = `${userId}:${fixedCostsKey}`;
  await prisma.appState.upsert({
    where: { key },
    create: { key, userId, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return NextResponse.json({ ok: true });
}
