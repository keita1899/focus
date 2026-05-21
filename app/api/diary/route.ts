import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const diaryKey = "diary-v1";

function getDiaryKey(userId: string) {
  return `${userId}:${diaryKey}`;
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await prisma.appState.findUnique({
    where: { key: getDiaryKey(userId) },
  });

  return NextResponse.json({
    value: state ? JSON.parse(state.value) : null,
  });
}

export async function PUT(request: Request) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const value = await request.json();
  const key = getDiaryKey(userId);

  await prisma.appState.upsert({
    where: { key },
    create: {
      key,
      userId,
      value: JSON.stringify(value),
    },
    update: {
      value: JSON.stringify(value),
    },
  });

  return NextResponse.json({ ok: true });
}
