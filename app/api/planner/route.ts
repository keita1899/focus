import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const plannerKey = "focus-planner-state-v1";
const roadmap2Key = "roadmap-2-v1";

function getPlannerKey(userId: string) {
  return `${userId}:${plannerKey}`;
}

function getRoadmap2Key(userId: string) {
  return `${userId}:${roadmap2Key}`;
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = getPlannerKey(userId);
  const state = await prisma.appState.findUnique({
    where: { key },
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
  const key = getPlannerKey(userId);

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

  const roadmapState = await prisma.appState.findUnique({
    where: { key: getRoadmap2Key(userId) },
  });
  const roadmap = roadmapState ? JSON.parse(roadmapState.value) as Record<string, unknown> : {};
  const existingYears = roadmap.years && typeof roadmap.years === "object"
    ? roadmap.years as Record<string, { annualGoals?: unknown; months?: unknown }>
    : {};
  const annualGoalsByPeriod = value.annualGoalsByPeriod && typeof value.annualGoalsByPeriod === "object"
    ? value.annualGoalsByPeriod as Record<string, unknown>
    : {};
  const monthGoals = value.goalsByPeriod?.month && typeof value.goalsByPeriod.month === "object"
    ? value.goalsByPeriod.month as Record<string, unknown>
    : {};
  const years = { ...existingYears };

  Object.entries(annualGoalsByPeriod).forEach(([year, goals]) => {
    const current = years[year] || { annualGoals: [""], months: [] };
    years[year] = {
      ...current,
      annualGoals: Array.isArray(goals) ? goals.filter((goal): goal is string => typeof goal === "string").slice(0, 5) : [""],
    };
  });
  Object.entries(monthGoals).forEach(([monthKey, goal]) => {
    const [year, rawMonth] = monthKey.split("-");
    const month = Number(rawMonth);
    if (!Number.isInteger(month) || month < 1 || month > 12) return;
    const current = years[year] || { annualGoals: [""], months: [] };
    const months = Array.isArray(current.months) ? current.months : [];
    const hasMonth = months.some((item) => item && typeof item === "object" && (item as { month?: unknown }).month === month);
    years[year] = {
      ...current,
      months: hasMonth
        ? months.map((item) => item && typeof item === "object" && (item as { month?: unknown }).month === month ? { ...(item as object), month, goal: typeof goal === "string" ? goal : "" } : item)
        : [...months, { month, goal: typeof goal === "string" ? goal : "" }],
    };
  });

  await prisma.appState.upsert({
    where: { key: getRoadmap2Key(userId) },
    create: {
      key: getRoadmap2Key(userId),
      userId,
      value: JSON.stringify({ selectedYear: new Date().getFullYear(), years }),
    },
    update: { value: JSON.stringify({ ...roadmap, years }) },
  });

  return NextResponse.json({ ok: true });
}
