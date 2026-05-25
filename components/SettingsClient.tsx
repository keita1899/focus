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

    fetch("/api/push/subscriptions", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { enabled?: boolean }) => setPushEnabled(Boolean(data.enabled)))
      .catch(() => undefined);
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

      await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

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
      if (!response.ok) {
        setPushStatus("テスト通知の送信に失敗しました。");
        return;
      }
      setPushStatus("テスト通知を送信しました。");
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
