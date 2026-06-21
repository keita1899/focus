"use client";

import { useEffect, useState } from "react";

type PlannerLike = Record<string, unknown> & {
  birthday?: string;
};

type SettingsClientProps = {
  initialPlannerValue: unknown;
};

const storageKey = "focus-planner-state-v1";

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

  return (
    <main className="shell settingsPage">
      <section className="settingsHeader" aria-label="設定">
        <div>
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

    </main>
  );
}
