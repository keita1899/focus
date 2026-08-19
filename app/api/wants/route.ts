import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const wantsKey = "wants-v1";

function getWantsKey(userId: string) {
  return `${userId}:${wantsKey}`;
}

export async function PUT(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const value = await request.json();
  await prisma.appState.upsert({
    where: { key: getWantsKey(userId) },
    create: { key: getWantsKey(userId), userId, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return NextResponse.json({ ok: true });
}
