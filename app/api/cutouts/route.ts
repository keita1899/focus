import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const cutoutsKey = "cutouts-v1";

function getCutoutsKey(userId: string) {
  return `${userId}:${cutoutsKey}`;
}

export async function PUT(request: Request) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const value = await request.json();

  await prisma.appState.upsert({
    where: { key: getCutoutsKey(userId) },
    create: {
      key: getCutoutsKey(userId),
      userId,
      value: JSON.stringify(value),
    },
    update: { value: JSON.stringify(value) },
  });

  return NextResponse.json({ ok: true });
}
