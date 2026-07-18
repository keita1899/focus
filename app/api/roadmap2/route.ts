import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const roadmap2Key = "roadmap-2-v1";

function getRoadmap2Key(userId: string) {
  return `${userId}:${roadmap2Key}`;
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await prisma.appState.findUnique({
    where: { key: getRoadmap2Key(userId) },
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

  await prisma.appState.upsert({
    where: { key: getRoadmap2Key(userId) },
    create: {
      key: getRoadmap2Key(userId),
      userId,
      value: JSON.stringify(value),
    },
    update: {
      value: JSON.stringify(value),
    },
  });

  return NextResponse.json({ ok: true });
}
