import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const shoppingListKey = "shopping-list-v1";

function getShoppingListKey(userId: string) {
  return `${userId}:${shoppingListKey}`;
}

export async function PUT(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const value = await request.json();
  await prisma.appState.upsert({
    where: { key: getShoppingListKey(userId) },
    create: { key: getShoppingListKey(userId), userId, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return NextResponse.json({ ok: true });
}
