import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/prisma";
import { sendWebPush } from "../../../../lib/push/web-push";

export const runtime = "nodejs";

type Weekday = "月" | "火" | "水" | "木" | "金" | "土" | "日";

type TimetableEntry = {
  id?: string;
  time?: string;
  title?: string;
  kind?: string;
  dailyTitles?: Record<string, string>;
};

type Timetable = {
  id?: string;
  name?: string;
  weekdays?: Weekday[];
  entries?: TimetableEntry[];
};

type PlannerState = {
  timetables?: Timetable[];
};

const plannerKey = "focus-planner-state-v1";
function getTokyoParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  const weekday = parts.weekday.replace("曜", "") as Weekday;

  return { dateKey, time, weekday };
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dateKey, time, weekday } = getTokyoParts(new Date());
  const nowMinutes = timeToMinutes(time);
  const windowMinutes = Number(process.env.SCHEDULE_PUSH_WINDOW_MINUTES || 5);

  const states = await prisma.appState.findMany({
    where: {
      key: { endsWith: `:${plannerKey}` },
      userId: { not: null },
    },
  });

  const summary = {
    checkedStates: states.length,
    matchedEntries: 0,
    usersWithSubscriptions: 0,
    deliveredEntries: 0,
    staleSubscriptions: 0,
    sent: 0,
  };

  for (const state of states) {
    if (!state.userId) continue;

    const planner = JSON.parse(state.value) as PlannerState;
    const todaysEntries = (planner.timetables || [])
      .filter((timetable) => (timetable.weekdays || []).includes(weekday))
      .flatMap((timetable) =>
        (timetable.entries || []).map((entry) => ({
          ...entry,
          timetableName: timetable.name || "今日の時間割",
        })),
      )
      .filter((entry) => {
        if (!entry.id || !entry.time) return false;
        const entryMinutes = timeToMinutes(entry.time);
        return entryMinutes <= nowMinutes && entryMinutes >= nowMinutes - windowMinutes;
      });

    summary.matchedEntries += todaysEntries.length;

    if (todaysEntries.length === 0) continue;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: state.userId },
    });

    if (subscriptions.length === 0) continue;
    summary.usersWithSubscriptions += 1;

    for (const entry of todaysEntries) {
      const deliveryKey = `${dateKey}:${entry.id}:${entry.time}`;
      const delivery = await prisma.notificationDelivery
        .create({
          data: {
            key: deliveryKey,
            userId: state.userId,
          },
        })
        .catch(() => null);

      if (!delivery) continue;
      summary.deliveredEntries += 1;

      const title =
        entry.kind === "timetable"
          ? entry.dailyTitles?.[dateKey] || entry.title || "時間割"
          : entry.title || "予定";
      const body = `${entry.time} ${entry.timetableName}`;

      const results = await Promise.allSettled(
        subscriptions.map((subscription) =>
          sendWebPush(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            {
              title,
              body,
              url: "/",
            },
          ),
        ),
      );

      summary.sent += results.filter((result) => result.status === "fulfilled")
        .length;

      const staleEndpoints = results
        .map((result, index) =>
          result.status === "rejected" &&
          typeof result.reason?.statusCode === "number" &&
          [404, 410].includes(result.reason.statusCode)
            ? subscriptions[index].endpoint
            : null,
        )
        .filter((endpoint): endpoint is string => Boolean(endpoint));

      if (staleEndpoints.length > 0) {
        summary.staleSubscriptions += staleEndpoints.length;
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: { in: staleEndpoints } },
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dateKey,
    time,
    weekday,
    windowMinutes,
    ...summary,
  });
}
