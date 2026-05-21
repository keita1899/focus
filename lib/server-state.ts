import { auth } from "../auth";
import { prisma } from "./prisma";

const plannerKey = "focus-planner-state-v1";
const inboxKey = "inbox-markdown-v1";
const diaryKey = "diary-v1";

function getScopedKey(userId: string, key: string) {
  return `${userId}:${key}`;
}

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getPlannerState() {
  const userId = await getUserId();
  if (!userId) return null;

  const state = await prisma.appState.findUnique({
    where: { key: getScopedKey(userId, plannerKey) },
  });

  return state ? JSON.parse(state.value) : null;
}

export async function getInboxState() {
  const userId = await getUserId();
  if (!userId) return null;

  const state = await prisma.appState.findUnique({
    where: { key: getScopedKey(userId, inboxKey) },
  });

  return state ? JSON.parse(state.value) : null;
}

export async function getDiaryState() {
  const userId = await getUserId();
  if (!userId) return null;

  const state = await prisma.appState.findUnique({
    where: { key: getScopedKey(userId, diaryKey) },
  });

  return state ? JSON.parse(state.value) : null;
}

export async function getMemoState() {
  const userId = await getUserId();
  if (!userId) return [];

  const memos = await prisma.memoBlock.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return memos.map((memo) => ({
    id: memo.id,
    title: memo.title,
    markdown: memo.markdown,
    viewMode: memo.viewMode,
  }));
}
