import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

type MemoPayload = {
  id?: string;
  markdown?: string;
  title?: string;
  viewMode?: string;
};

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memos = await prisma.memoBlock.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    value: memos.map((memo) => ({
      id: memo.id,
      title: memo.title,
      markdown: memo.markdown,
      viewMode: memo.viewMode,
    })),
  });
}

export async function PUT(request: Request) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const value = (await request.json()) as MemoPayload[];
  const memos = Array.isArray(value) ? value : [];

  await prisma.$transaction([
    prisma.memoBlock.deleteMany({ where: { userId } }),
    prisma.memoBlock.createMany({
      data: memos.map((memo, index) => ({
        id: memo.id,
        userId,
        title: memo.title || "メモ",
        markdown: memo.markdown || "",
        viewMode:
          memo.viewMode === "split" ||
          memo.viewMode === "preview" ||
          memo.viewMode === "memo"
            ? memo.viewMode
            : "preview",
        sortOrder: index,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
