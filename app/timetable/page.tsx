"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

type Weekday = "月" | "火" | "水" | "木" | "金" | "土" | "日";

type TimetableEntry = {
  id: string;
  time: string;
  title: string;
  kind: TimetableKind;
  completedDates?: string[];
  dailyTitles?: Record<string, string>;
};

type TimetableKind = "schedule" | "timetable" | "habit";

type Timetable = {
  id: string;
  name: string;
  kind: TimetableKind;
  weekdays: Weekday[];
  entries: TimetableEntry[];
};

type PlannerLike = Record<string, unknown> & {
  timetable?: unknown;
  timetables?: Timetable[];
};

type EditingTarget = {
  entryId?: string;
  timetableId: string;
  field: "name" | "time" | "title";
} | null;

const storageKey = "focus-planner-state-v1";
const weekdayOptions: Weekday[] = ["月", "火", "水", "木", "金", "土", "日"];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCurrentTimeValue() {
  const now = new Date();
  const minutes = Math.floor(now.getMinutes() / 10) * 10;
  return `${String(now.getHours()).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeEntries(
  entries: Partial<TimetableEntry>[] | undefined,
  fallbackKind: TimetableKind = "schedule",
) {
  return (entries || [])
    .map((entry, index) => ({
      id: entry.id || `timetable-entry-${index + 1}`,
      time: entry.time || "09:00",
      title: entry.title || "",
      kind:
        entry.kind === "timetable" || entry.kind === "habit"
          ? entry.kind
          : fallbackKind,
      completedDates: Array.isArray(entry.completedDates)
        ? entry.completedDates
        : [],
      dailyTitles:
        entry.dailyTitles && typeof entry.dailyTitles === "object"
          ? entry.dailyTitles
          : {},
    }))
    .sort((first, second) => first.time.localeCompare(second.time));
}

function normalizeTimetables(value: unknown, legacyValue?: unknown): Timetable[] {
  if (Array.isArray(value)) {
    const usedWeekdays = new Set<Weekday>();
    return value.map((item, index) => {
      const timetable = item as Partial<Timetable>;
      const weekdays = (timetable.weekdays || []).filter((weekday): weekday is Weekday => {
        if (!weekdayOptions.includes(weekday as Weekday) || usedWeekdays.has(weekday as Weekday)) {
          return false;
        }
        usedWeekdays.add(weekday as Weekday);
        return true;
      });
      return {
        id: timetable.id || `timetable-${index + 1}`,
        name: timetable.name || `時間割 ${index + 1}`,
        kind: timetable.kind === "timetable" ? "timetable" : "schedule",
        weekdays,
        entries: normalizeEntries(timetable.entries, timetable.kind),
      };
    });
  }

  if (!legacyValue || typeof legacyValue !== "object") return [];
  const legacy = legacyValue as Partial<Record<Weekday, Partial<TimetableEntry>[]>>;
  return weekdayOptions
    .map((weekday) => ({
      id: `timetable-${weekday}`,
      name: `${weekday}曜日`,
      kind: "schedule" as const,
      weekdays: [weekday],
      entries: normalizeEntries(legacy[weekday]),
    }))
    .filter((timetable) => timetable.entries.length > 0);
}

function normalizePlanner(value: unknown): PlannerLike {
  if (!value || typeof value !== "object") {
    return { timetables: [] };
  }
  const planner = value as PlannerLike;
  return {
    ...planner,
    timetables: normalizeTimetables(planner.timetables, planner.timetable),
  };
}

export default function TimetablePage() {
  const [planner, setPlanner] = useState<PlannerLike>({ timetables: [] });
  const [isReady, setIsReady] = useState(false);
  const [activeTimetableId, setActiveTimetableId] = useState("");
  const [newTimetableName, setNewTimetableName] = useState("");
  const [sourceTimetableId, setSourceTimetableId] = useState("");
  const [entryTime, setEntryTime] = useState(getCurrentTimeValue());
  const [entryTitle, setEntryTitle] = useState("");
  const [entryKind, setEntryKind] = useState<TimetableKind>("schedule");
  const [editing, setEditing] = useState<EditingTarget>(null);

  useEffect(() => {
    async function loadPlanner() {
      try {
        const response = await fetch("/api/planner", { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        if (data.value) {
          const nextPlanner = normalizePlanner(data.value);
          setPlanner(nextPlanner);
          setActiveTimetableId(nextPlanner.timetables?.[0]?.id || "");
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        const nextPlanner = normalizePlanner(JSON.parse(stored));
        setPlanner(nextPlanner);
        setActiveTimetableId(nextPlanner.timetables?.[0]?.id || "");
        await fetch("/api/planner", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextPlanner),
        });
        window.localStorage.removeItem(storageKey);
      } catch {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) {
          setPlanner({ timetables: [] });
          return;
        }
        try {
          const nextPlanner = normalizePlanner(JSON.parse(stored));
          setPlanner(nextPlanner);
          setActiveTimetableId(nextPlanner.timetables?.[0]?.id || "");
        } catch {
          setPlanner({ timetables: [] });
        }
      }
    }

    loadPlanner().finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (isReady) {
      fetch("/api/planner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planner),
      }).catch(() => undefined);
    }
  }, [isReady, planner]);

  const timetables = planner.timetables || [];
  const activeTimetable = useMemo(
    () =>
      timetables.find((timetable) => timetable.id === activeTimetableId) ||
      timetables[0] ||
      null,
    [activeTimetableId, timetables],
  );

  useEffect(() => {
    if (!activeTimetable && timetables[0]) {
      setActiveTimetableId(timetables[0].id);
    }
  }, [activeTimetable, timetables]);

  if (!isReady) {
    return <main className="shell timetablePage" aria-label="読み込み中" />;
  }

  function finishEditing(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur();
      setEditing(null);
    }
  }

  function setTimetables(updater: (current: Timetable[]) => Timetable[]) {
    setPlanner((current) => ({
      ...current,
      timetables: updater(normalizeTimetables(current.timetables, current.timetable)),
    }));
  }

  function addTimetable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTimetableName.trim()) return;
    const id = createId("timetable");
    const sourceTimetable = timetables.find(
      (timetable) => timetable.id === sourceTimetableId,
    );
    setTimetables((current) => [
      ...current,
      {
        id,
        name: newTimetableName.trim(),
        kind: sourceTimetable?.kind || "schedule",
        weekdays: [],
        entries:
          sourceTimetable?.entries.map((entry) => ({
            ...entry,
            id: createId("timetable-entry"),
            completedDates: [],
            dailyTitles: {},
          })) || [],
      },
    ]);
    setActiveTimetableId(id);
    setNewTimetableName("");
    setSourceTimetableId("");
  }

  function updateTimetableName(id: string, name: string) {
    setTimetables((current) =>
      current.map((timetable) =>
        timetable.id === id ? { ...timetable, name } : timetable,
      ),
    );
  }

  function removeTimetable(id: string) {
    const nextActive = timetables.find((timetable) => timetable.id !== id)?.id || "";
    setTimetables((current) => current.filter((timetable) => timetable.id !== id));
    if (activeTimetableId === id) {
      setActiveTimetableId(nextActive);
    }
  }

  function toggleWeekday(timetableId: string, weekday: Weekday) {
    setTimetables((current) =>
      current.map((timetable) => {
        if (timetable.id !== timetableId) {
          return {
            ...timetable,
            weekdays: timetable.weekdays.filter((item) => item !== weekday),
          };
        }
        const exists = timetable.weekdays.includes(weekday);
        return {
          ...timetable,
          weekdays: exists
            ? timetable.weekdays.filter((item) => item !== weekday)
            : [...timetable.weekdays, weekday].sort(
                (first, second) =>
                  weekdayOptions.indexOf(first) - weekdayOptions.indexOf(second),
              ),
        };
      }),
    );
  }

  function updateEntry(
    timetableId: string,
    entryId: string,
    field: "time" | "title",
    value: string,
  ) {
    setTimetables((current) =>
      current.map((timetable) =>
        timetable.id === timetableId
          ? {
              ...timetable,
              entries: timetable.entries
                .map((entry) =>
                  entry.id === entryId ? { ...entry, [field]: value } : entry,
                )
                .sort((first, second) => first.time.localeCompare(second.time)),
            }
          : timetable,
      ),
    );
  }

  function removeEntry(timetableId: string, entryId: string) {
    setTimetables((current) =>
      current.map((timetable) =>
        timetable.id === timetableId
          ? {
              ...timetable,
              entries: timetable.entries.filter((entry) => entry.id !== entryId),
            }
          : timetable,
      ),
    );
  }

  function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTimetable) return;
    if (entryKind !== "timetable" && !entryTitle.trim()) return;
    setTimetables((current) =>
      current.map((timetable) =>
        timetable.id === activeTimetable.id
          ? {
              ...timetable,
              entries: [
                ...timetable.entries,
                {
                  id: createId("timetable-entry"),
                  time: entryTime,
                  title: entryKind === "timetable" ? "" : entryTitle.trim(),
                  kind: entryKind,
                  completedDates: [],
                  dailyTitles: {},
                },
              ].sort((first, second) => first.time.localeCompare(second.time)),
            }
          : timetable,
      ),
    );
    setEntryTitle("");
  }

  return (
    <main className="shell timetablePage">
      <section className="timetablePageHeader" aria-label="時間割">
        <div>
          <a className="backLink" href="/">
            ← メイン
          </a>
          <h1>Timetable</h1>
        </div>
        <form className="timetableCreateForm" onSubmit={addTimetable}>
          <input
            placeholder="名前"
            value={newTimetableName}
            onChange={(event) => setNewTimetableName(event.target.value)}
          />
          <select
            aria-label="コピー元"
            value={sourceTimetableId}
            onChange={(event) => setSourceTimetableId(event.target.value)}
          >
            <option value="">空から作成</option>
            {timetables.map((timetable) => (
              <option key={timetable.id} value={timetable.id}>
                {timetable.name || "名称未設定"}をコピー
              </option>
            ))}
          </select>
          <button type="submit">作成</button>
        </form>
      </section>

      <section className="timetableEditorCard" aria-label="時間割管理">
        {timetables.length > 0 && (
          <div className="scheduleTabList" role="tablist" aria-label="時間割">
            {timetables.map((timetable) => (
              <button
                className={
                  activeTimetable?.id === timetable.id
                    ? "scheduleTab active"
                    : "scheduleTab"
                }
                key={timetable.id}
                type="button"
                role="tab"
                aria-selected={activeTimetable?.id === timetable.id}
                onClick={() => setActiveTimetableId(timetable.id)}
              >
                {timetable.name || "名称未設定"}
              </button>
            ))}
          </div>
        )}

        {!activeTimetable && (
          <p className="emptyText">時間割を作成してください。</p>
        )}

        {activeTimetable && (
          <>
            <div className="timetableEditorHeader">
              {editing?.timetableId === activeTimetable.id &&
              editing.field === "name" ? (
                <input
                  aria-label="時間割名"
                  autoFocus
                  value={activeTimetable.name}
                  onBlur={() => setEditing(null)}
                  onKeyDown={finishEditing}
                  onChange={(event) =>
                    updateTimetableName(activeTimetable.id, event.target.value)
                  }
                />
              ) : (
                <h2
                  onDoubleClick={() =>
                    setEditing({
                      timetableId: activeTimetable.id,
                      field: "name",
                    })
                  }
                >
                  {activeTimetable.name || "名称未設定"}
                </h2>
              )}
              <button
                className="iconButton visible"
                type="button"
                onClick={() => removeTimetable(activeTimetable.id)}
                aria-label={`${activeTimetable.name}を削除`}
              >
                ×
              </button>
            </div>

            <div className="weekdayToggleRow" aria-label="適用する曜日">
              {weekdayOptions.map((weekday) => (
                <button
                  className={
                    activeTimetable.weekdays.includes(weekday)
                      ? "weekdayToggle active"
                      : "weekdayToggle"
                  }
                  key={weekday}
                  type="button"
                  onClick={() => toggleWeekday(activeTimetable.id, weekday)}
                >
                  {weekday}
                </button>
              ))}
            </div>

            <div className="timetableEntryList">
              {activeTimetable.entries.length === 0 && (
                <p className="emptyText">この時間割には項目がありません。</p>
              )}
              {activeTimetable.entries.map((entry) => (
                <article
                  className={
                    entry.kind === "timetable"
                      ? "timetableEntry hasNumber"
                      : "timetableEntry"
                  }
                  key={entry.id}
                >
                  {editing?.entryId === entry.id && editing.field === "time" ? (
                    <input
                      aria-label={`${entry.title}の時刻`}
                      autoFocus
                      step="600"
                      type="time"
                      value={entry.time}
                      onBlur={() => setEditing(null)}
                      onKeyDown={finishEditing}
                      onChange={(event) =>
                        updateEntry(
                          activeTimetable.id,
                          entry.id,
                          "time",
                          event.target.value,
                        )
                      }
                    />
                  ) : (
                    <time
                      onDoubleClick={() =>
                        setEditing({
                          timetableId: activeTimetable.id,
                          entryId: entry.id,
                          field: "time",
                        })
                      }
                    >
                      {entry.time}
                    </time>
                  )}
                  {entry.kind === "timetable" && (
                    <span className="periodBadge">
                      {
                        activeTimetable.entries
                          .filter((item) => item.kind === "timetable")
                          .findIndex((item) => item.id === entry.id) + 1
                      }
                    </span>
                  )}
                  {entry.kind === "timetable" ? (
                    <strong>{entry.title}</strong>
                  ) : editing?.entryId === entry.id && editing.field === "title" ? (
                    <input
                      aria-label={`${entry.title}を編集`}
                      autoFocus
                      value={entry.title}
                      onBlur={() => setEditing(null)}
                      onKeyDown={finishEditing}
                      onChange={(event) =>
                        updateEntry(
                          activeTimetable.id,
                          entry.id,
                          "title",
                          event.target.value,
                        )
                      }
                    />
                  ) : (
                    <strong
                      className="editableTitle"
                      onDoubleClick={() =>
                        setEditing({
                          timetableId: activeTimetable.id,
                          entryId: entry.id,
                          field: "title",
                        })
                      }
                    >
                      {entry.title || "名称未設定"}
                    </strong>
                  )}
                  <button
                    className="iconButton"
                    type="button"
                    onClick={() => removeEntry(activeTimetable.id, entry.id)}
                    aria-label={`${entry.title}を削除`}
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>

            <form
              className={
                entryKind === "timetable"
                  ? "timetableEntryForm compact"
                  : "timetableEntryForm"
              }
              onSubmit={addEntry}
            >
              <input
                aria-label="時刻"
                step="600"
                type="time"
                value={entryTime}
                onChange={(event) => setEntryTime(event.target.value)}
              />
              <select
                aria-label="種別"
                value={entryKind}
                onChange={(event) =>
                  setEntryKind(event.target.value as TimetableKind)
                }
              >
                <option value="schedule">スケジュール</option>
                <option value="timetable">時間割</option>
                <option value="habit">習慣</option>
              </select>
              {entryKind !== "timetable" && (
                <input
                  placeholder="内容"
                  value={entryTitle}
                  onChange={(event) => setEntryTitle(event.target.value)}
                />
              )}
              <button type="submit" aria-label="時間割を追加">
                +
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
