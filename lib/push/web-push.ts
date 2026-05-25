import webpush, { type PushSubscription } from "web-push";

const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export function getVapidPublicKey() {
  return vapidPublicKey || "";
}

export function assertPushConfigured() {
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error(
      "Push notifications require NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
    );
  }
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload,
) {
  assertPushConfigured();
  webpush.setVapidDetails(vapidSubject, vapidPublicKey!, vapidPrivateKey!);

  return webpush.sendNotification(subscription, JSON.stringify(payload));
}
