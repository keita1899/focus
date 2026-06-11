"use client";

import { useEffect, useState } from "react";

type PlannerLike = Record<string, unknown> & {
  birthday?: string;
};

type SettingsClientProps = {
  initialPlannerValue: unknown;
};

const storageKey = "focus-planner-state-v1";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function normalizePlanner(value: unknown): PlannerLike {
  if (!value || typeof value !== "object") {
    return {
      birthday: "",
    };
  }

  const planner = value as PlannerLike;
  return {
    ...planner,
    birthday: planner.birthday || "",
  };
}

export default function SettingsClient({ initialPlannerValue }: SettingsClientProps) {
  const [planner, setPlanner] = useState<PlannerLike>(() =>
    normalizePlanner(initialPlannerValue),
  );
  const [isReady, setIsReady] = useState(initialPlannerValue !== null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState("");

  useEffect(() => {
    if (initialPlannerValue !== null) return;

    async function loadPlanner() {
      try {
        const response = await fetch("/api/planner", { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        if (data.value) {
          setPlanner(normalizePlanner(data.value));
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        const nextPlanner = normalizePlanner(JSON.parse(stored));
        setPlanner(nextPlanner);
        await fetch("/api/planner", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextPlanner),
        });
        window.localStorage.removeItem(storageKey);
      } catch {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) {
          setPlanner({ birthday: "" });
          return;
        }
        try {
          setPlanner(normalizePlanner(JSON.parse(stored)));
        } catch {
          setPlanner({ birthday: "" });
        }
      }
    }

    loadPlanner().finally(() => setIsReady(true));
  }, [initialPlannerValue]);

  useEffect(() => {
    if (isReady) {
      fetch("/api/planner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planner),
      }).catch(() => undefined);
    }
  }, [isReady, planner]);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);

    if (!supported) return;

    async function syncPushState() {
      try {
        const [response, registration] = await Promise.all([
          fetch("/api/push/subscriptions", { cache: "no-store" }),
          navigator.serviceWorker.getRegistration(),
        ]);
        const data = (await response.json()) as { enabled?: boolean };
        const subscription = await registration?.pushManager.getSubscription();

        if (subscription && !data.enabled) {
          const syncResponse = await fetch("/api/push/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
          });
          setPushEnabled(syncResponse.ok);
          return;
        }

        setPushEnabled(Boolean(data.enabled && subscription));
      } catch {
        setPushEnabled(false);
      }
    }

    syncPushState();
  }, []);

  async function enablePush() {
    if (!pushSupported) return;

    try {
      setPushStatus("通知を設定しています...");
      const keyResponse = await fetch("/api/push/public-key", {
        cache: "no-store",
      });
      const { publicKey } = (await keyResponse.json()) as { publicKey?: string };

      if (!publicKey) {
        setPushStatus("VAPIDキーが未設定です。環境変数を設定してください。");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("通知が許可されませんでした。");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const saveResponse = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      const saveData = (await saveResponse.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!saveResponse.ok) {
        setPushEnabled(false);
        if (saveResponse.status === 401) {
          setPushStatus("通知の保存に失敗しました。再ログインして試してください。");
          return;
        }
        if (saveResponse.status === 400) {
          setPushStatus("通知の登録情報を取得できませんでした。通知を一度解除して再度有効化してください。");
          return;
        }
        setPushStatus(
          saveData.error
            ? `通知の保存に失敗しました: ${saveData.error}`
            : "通知の保存に失敗しました。",
        );
        return;
      }

      setPushEnabled(true);
      setPushStatus("Push通知を有効にしました。");
    } catch {
      setPushStatus("Push通知の設定に失敗しました。");
    }
  }

  async function disablePush() {
    try {
      setPushStatus("通知を解除しています...");
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription?.endpoint }),
      });
      await subscription?.unsubscribe();

      setPushEnabled(false);
      setPushStatus("Push通知を解除しました。");
    } catch {
      setPushStatus("Push通知の解除に失敗しました。");
    }
  }

  async function sendTestPush() {
    try {
      setPushStatus("テスト通知を送信しています...");
      const response = await fetch("/api/push/test", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
      };
      if (!response.ok) {
        if (response.status === 401) {
          setPushStatus("ログインが切れています。再ログインしてください。");
          return;
        }
        if (response.status === 410) {
          setPushEnabled(false);
          setPushStatus("通知の登録が古くなっています。もう一度有効化してください。");
          return;
        }
        if (data.error?.includes("VAPID")) {
          setPushStatus("Push通知の環境変数が本番環境に設定されていません。");
          return;
        }
        setPushStatus(
          data.error
            ? `テスト通知の送信に失敗しました: ${data.error}`
            : "テスト通知の送信に失敗しました。",
        );
        return;
      }
      if (document.visibilityState === "visible") {
        const registration = await navigator.serviceWorker.ready;
        await registration
          .showNotification("Focus Planner", {
            body: "Push通知のテストです。",
            icon: "/icon.svg",
            badge: "/maskable-icon.svg",
            data: { url: "/" },
          })
          .catch(() => undefined);
      }
      setPushStatus(
        `テスト通知を送信しました。送信先: ${data.sent ?? 1}件`,
      );
    } catch {
      setPushStatus("テスト通知の送信に失敗しました。");
    }
  }

  return (
    <main className="shell settingsPage">
      <section className="settingsHeader" aria-label="設定">
        <div>
          <a className="backLink" href="/">
            ← メイン
          </a>
          <h1>Settings</h1>
        </div>
      </section>

      <section className="settingsPanel" aria-label="プロフィール設定">
        <label>
          <span>誕生日</span>
          <input
            type="date"
            value={planner.birthday || ""}
            onChange={(event) =>
              setPlanner((current) => ({
                ...current,
                birthday: event.target.value,
              }))
            }
          />
        </label>
      </section>

      <section className="settingsPanel" aria-label="通知設定">
        <div className="settingsPanelHeader">
          <h2>Push通知</h2>
          <span>{pushEnabled ? "有効" : "無効"}</span>
        </div>
        <p className="settingsDescription">
          今日の時間割に登録した予定を、ブラウザ通知で受け取れます。
        </p>
        <div className="settingsActions">
          <button
            type="button"
            onClick={pushEnabled ? disablePush : enablePush}
            disabled={!pushSupported}
          >
            {pushEnabled ? "通知を解除" : "通知を有効化"}
          </button>
          <button type="button" onClick={sendTestPush} disabled={!pushEnabled}>
            テスト送信
          </button>
        </div>
        {!pushSupported && (
          <p className="settingsDescription">
            このブラウザはPush通知に対応していません。
          </p>
        )}
        {pushStatus && <p className="settingsStatus">{pushStatus}</p>}
      </section>
    </main>
  );
}
