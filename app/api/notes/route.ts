import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const notesKey = "simple-notes-v1";

function getNotesKey(userId: string) {
  return `${userId}:${notesKey}`;
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await prisma.appState.findUnique({
    where: { key: getNotesKey(userId) },
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
    where: { key: getNotesKey(userId) },
    create: {
      key: getNotesKey(userId),
      userId,
      value: JSON.stringify(value),
    },
    update: {
      value: JSON.stringify(value),
    },
  });

  return NextResponse.json({ ok: true });
}
