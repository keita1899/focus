import { NextResponse } from "next/server";

import { getUserId } from "../../../lib/auth-user";
import { prisma } from "../../../lib/prisma";

const roadmap2Key = "roadmap-2-v1";
const plannerKey = "focus-planner-state-v1";

function getRoadmap2Key(userId: string) {
  return `${userId}:${roadmap2Key}`;
}

function getPlannerKey(userId: string) {
  return `${userId}:${plannerKey}`;
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

  const plannerState = await prisma.appState.findUnique({
    where: { key: getPlannerKey(userId) },
  });
  const planner = plannerState ? JSON.parse(plannerState.value) as Record<string, unknown> : {};
  const goalsByPeriod = (planner.goalsByPeriod && typeof planner.goalsByPeriod === "object" ? planner.goalsByPeriod : {}) as Record<string, Record<string, string>>;
  const yearlyGoals = { ...(goalsByPeriod.year || {}) };
  const monthlyGoals = { ...(goalsByPeriod.month || {}) };
  const annualGoalsByPeriod: Record<string, string[]> = {};
  const years = value && typeof value === "object" && value.years && typeof value.years === "object"
    ? value.years as Record<string, { annualGoals?: unknown; months?: unknown }>
    : {};

  Object.entries(years).forEach(([year, plan]) => {
    const annualGoals = Array.isArray(plan.annualGoals)
      ? plan.annualGoals.filter((goal): goal is string => typeof goal === "string").slice(0, 5)
      : [];
    annualGoalsByPeriod[year] = annualGoals.length ? annualGoals : [""];
    yearlyGoals[year] = annualGoals.filter(Boolean).join("\n");
    if (!Array.isArray(plan.months)) return;
    plan.months.forEach((month) => {
      if (!month || typeof month !== "object") return;
      const item = month as { month?: unknown; goal?: unknown };
      if (typeof item.month !== "number" || item.month < 1 || item.month > 12) return;
      monthlyGoals[`${year}-${String(item.month).padStart(2, "0")}`] = typeof item.goal === "string" ? item.goal : "";
    });
  });

  await prisma.appState.upsert({
    where: { key: getPlannerKey(userId) },
    create: {
      key: getPlannerKey(userId),
      userId,
      value: JSON.stringify({
        goalsByPeriod: { year: yearlyGoals, month: monthlyGoals, week: {} },
        annualGoalsByPeriod,
      }),
    },
    update: {
      value: JSON.stringify({
        ...planner,
        goalsByPeriod: { ...goalsByPeriod, year: yearlyGoals, month: monthlyGoals },
        annualGoalsByPeriod,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
