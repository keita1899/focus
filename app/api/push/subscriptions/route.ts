import { NextResponse } from "next/server";

import { getUserId } from "../../../../lib/auth-user";
import { prisma } from "../../../../lib/prisma";

type PushSubscriptionInput = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.pushSubscription.count({
    where: { userId },
  });

  return NextResponse.json({ enabled: count > 0 });
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = (await request.json()) as PushSubscriptionInput;
    const endpoint =
      typeof subscription.endpoint === "string" ? subscription.endpoint : "";
    const p256dh =
      typeof subscription.keys?.p256dh === "string"
        ? subscription.keys.p256dh
        : "";
    const auth =
      typeof subscription.keys?.auth === "string" ? subscription.keys.auth : "";

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Invalid push subscription" },
        { status: 400 },
      );
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh,
        auth,
        userAgent: request.headers.get("user-agent"),
        userId,
      },
      update: {
        p256dh,
        auth,
        userAgent: request.headers.get("user-agent"),
        userId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint } = (await request.json().catch(() => ({}))) as {
    endpoint?: unknown;
  };

  if (typeof endpoint === "string" && endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
  } else {
    await prisma.pushSubscription.deleteMany({
      where: { userId },
    });
  }

  return NextResponse.json({ ok: true });
}
