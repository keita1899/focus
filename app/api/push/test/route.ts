import { NextResponse } from "next/server";

import { getUserId } from "../../../../lib/auth-user";
import { prisma } from "../../../../lib/prisma";
import { sendWebPush } from "../../../../lib/push/web-push";

export const runtime = "nodejs";

export async function POST() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return NextResponse.json(
      { error: "Push notification is not enabled" },
      { status: 400 },
    );
  }

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
          title: "Focus Planner",
          body: "Push通知のテストです。",
          url: "/",
        },
      ),
    ),
  );

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
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: staleEndpoints } },
    });
  }

  return NextResponse.json({
    ok: true,
    sent: results.filter((result) => result.status === "fulfilled").length,
  });
}
