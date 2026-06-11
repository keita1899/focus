import { NextResponse } from "next/server";

import { getUserId } from "../../../../lib/auth-user";
import { prisma } from "../../../../lib/prisma";
import { sendWebPush } from "../../../../lib/push/web-push";

export const runtime = "nodejs";

function getPushErrorMessage(reason: unknown) {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (
    reason &&
    typeof reason === "object" &&
    "body" in reason &&
    typeof reason.body === "string"
  ) {
    return reason.body;
  }

  return "Unknown push error";
}

export async function POST() {
  try {
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

    const sent = results.filter((result) => result.status === "fulfilled")
      .length;
    const failed = results.filter((result) => result.status === "rejected");

    if (sent === 0) {
      return NextResponse.json(
        {
          error:
            staleEndpoints.length > 0
              ? "Saved push subscription is no longer valid. Enable notifications again."
              : getPushErrorMessage(failed[0]?.reason),
          staleSubscriptions: staleEndpoints.length,
        },
        { status: staleEndpoints.length > 0 ? 410 : 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed: failed.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getPushErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
