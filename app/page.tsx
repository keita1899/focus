"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { SignOutButton } from "../components/AuthControls";

type GoalKey = "year" | "month" | "week";
type GoalMap = Record<GoalKey, string>;
type PeriodGoalMap = Record<GoalKey, Record<string, string>>;
type PeriodOffsets = Record<GoalKey, number>;
type Weekday = "月" | "火" | "水" | "木" | "金" | "土" | "日";

type PriorityTask = {
  id: string;
  title: string;
  done: boolean;
  projectName?: string;
};

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

type PlannerState = {
  goals: GoalMap;
  goalsByPeriod: PeriodGoalMap;
  birthday: string;
  priorities: PriorityTask[];
  priorityBatchLocked: boolean;
  timetables: Timetable[];
};

type StoredPlannerState = Partial<PlannerState> & {
  timetable?: unknown;
};

type FocusTarget = {
  kind: "priority";
  id: string;
} | null;

type EditingTarget = {
  kind: "priority";
  id: string;
} | null;

const storageKey = "focus-planner-state-v1";

const initialState: PlannerState = {
  goals: {
    year: "収益性のある個人プロダクトを1つ公開する",
    month: "MVPを完成させ、利用者10人から感想をもらう",
    week: "核となる画面と保存機能を完成させる",
  },
  goalsByPeriod: {
    year: {},
    month: {},
    week: {},
  },
  birthday: "",
  priorities: [
    {
      id: "priority-1",
      title: "最重要機能を実装",
      done: false,
    },
    {
      id: "priority-2",
      title: "ユーザー導線を確認",
      done: false,
    },
    {
      id: "priority-3",
      title: "公開前チェック",
      done: false,
    },
  ],
  priorityBatchLocked: true,
  timetables: [],
};

const goalLabels: Record<GoalKey, string> = {
  year: "今年の目標",
  month: "今月の目標",
  week: "今週の目標",
};
const weekdayOptions: Weekday[] = ["月", "火", "水", "木", "金", "土", "日"];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayLabel() {
  const today = new Date();
  return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
}

function getTodayWeekday(): Weekday {
  const weekdays: Weekday[] = ["日", "月", "火", "水", "木", "金", "土"];
  return weekdays[new Date().getDay()];
}

function getCurrentTimeValue() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getDaysUntil(date: Date) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.ceil((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / oneDay),
  );
}

function getRemainingDaysInPeriod(nextPeriodStart: Date) {
  return Math.max(0, getDaysUntil(nextPeriodStart) - 1);
}

function getWeekStartDate(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const distanceFromMonday = day === 0 ? 1 : 1 - day;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() + distanceFromMonday + offset * 7);
  return monday;
}

function getWeekRangeLabel(offset = 0) {
  const monday = getWeekStartDate(offset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return `${formatMonthDay(monday)}~${formatMonthDay(sunday)}`;
}

function getPeriodInfo(offsets: PeriodOffsets) {
  const today = new Date();
  const yearDate = new Date(today);
  yearDate.setFullYear(today.getFullYear() + offsets.year);

  const monthDate = new Date(today);
  monthDate.setMonth(today.getMonth() + offsets.month);

  const nextYearDate = new Date(yearDate.getFullYear() + 1, 0, 1);
  const nextMonthDate = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    1,
  );
  const nextWeekDate = getWeekStartDate(offsets.week + 1);

  return {
    labels: {
      year: `${yearDate.getFullYear()}年`,
      month: `${monthDate.getMonth() + 1}月`,
      week: getWeekRangeLabel(offsets.week),
    },
    keys: {
      year: String(yearDate.getFullYear()),
      month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      week: formatDateKey(getWeekStartDate(offsets.week)),
    },
    remainingDays: {
      year: getRemainingDaysInPeriod(nextYearDate),
      month: getRemainingDaysInPeriod(nextMonthDate),
      week: getRemainingDaysInPeriod(nextWeekDate),
    },
  };
}

function getGoalLabel(key: GoalKey, offset: number, periodLabel: string) {
  if (offset === 0) return goalLabels[key];

  if (key === "week") {
    if (offset === -1) return "先週の目標";
    if (offset === 1) return "来週の目標";
    return `${periodLabel}の目標`;
  }

  if (key === "month") {
    if (offset === -1) return "先月の目標";
    if (offset === 1) return "来月の目標";
    return `${periodLabel}の目標`;
  }

  if (offset === -1) return "去年の目標";
  if (offset === 1) return "来年の目標";
  return `${periodLabel}の目標`;
}

function getAgeInfo(birthday: string) {
  if (!birthday) return null;
  const [birthYear, birthMonth, birthDay] = birthday.split("-").map(Number);
  if (!birthYear || !birthMonth || !birthDay) return null;

  const today = startOfDay(new Date());
  const birthdayThisYear = new Date(
    today.getFullYear(),
    birthMonth - 1,
    birthDay,
  );
  const hasHadBirthday = birthdayThisYear.getTime() <= today.getTime();
  const age = today.getFullYear() - birthYear - (hasHadBirthday ? 0 : 1);
  const nextBirthday = new Date(
    today.getFullYear() + (hasHadBirthday ? 1 : 0),
    birthMonth - 1,
    birthDay,
  );

  return {
    age,
    nextAge: age + 1,
    daysUntilNextAge: getDaysUntil(nextBirthday),
  };
}

function normalizePlanner(value: StoredPlannerState): PlannerState {
  const rawPriorities = Array.isArray(value.priorities)
    ? value.priorities
    : initialState.priorities;
  const currentPeriodInfo = getPeriodInfo({ year: 0, month: 0, week: 0 });
  const storedGoalsByPeriod = value.goalsByPeriod || initialState.goalsByPeriod;
  const goalsByPeriod: PeriodGoalMap = {
    year: { ...storedGoalsByPeriod.year },
    month: { ...storedGoalsByPeriod.month },
    week: { ...storedGoalsByPeriod.week },
  };

  (Object.keys(initialState.goals) as GoalKey[]).forEach((key) => {
    const periodKey = currentPeriodInfo.keys[key];
    if (!goalsByPeriod[key][periodKey]) {
      goalsByPeriod[key][periodKey] =
        value.goals?.[key] || initialState.goals[key];
    }
  });

  return {
    goals: {
      ...initialState.goals,
      ...value.goals,
    },
    goalsByPeriod,
    birthday: typeof value.birthday === "string" ? value.birthday : "",
    priorities: rawPriorities.slice(0, 3).map((task, index) => ({
      id: task.id || `priority-${index + 1}`,
      title: task.title || "",
      done: Boolean(task.done),
      projectName: task.projectName || undefined,
    })),
    priorityBatchLocked:
      typeof value.priorityBatchLocked === "boolean"
        ? value.priorityBatchLocked
        : rawPriorities.length > 0,
    timetables: normalizeTimetables(value.timetables, value.timetable),
  };
}

function normalizeTimetableEntries(
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
        entries: normalizeTimetableEntries(timetable.entries, timetable.kind),
      };
    });
  }

  if (!legacyValue || typeof legacyValue !== "object") return initialState.timetables;
  const legacy = legacyValue as Partial<Record<Weekday, Partial<TimetableEntry>[]>>;
  return weekdayOptions
    .map((weekday) => ({
      id: `timetable-${weekday}`,
      name: `${weekday}曜日`,
      kind: "schedule" as const,
      weekdays: [weekday],
      entries: normalizeTimetableEntries(legacy[weekday]),
    }))
    .filter((timetable) => timetable.entries.length > 0);
}

export default function Home() {
  const { data: session } = useSession();
  const [planner, setPlanner] = useState<PlannerState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [priorityTitle, setPriorityTitle] = useState("");
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [editing, setEditing] = useState<EditingTarget>(null);
  const [periodOffsets, setPeriodOffsets] = useState<PeriodOffsets>({
    year: 0,
    month: 0,
    week: 0,
  });
  const [currentTime, setCurrentTime] = useState(getCurrentTimeValue());
  const periodInfo = getPeriodInfo(periodOffsets);
  const periodLabels = periodInfo.labels;
  const periodKeys = periodInfo.keys;
  const remainingDays = periodInfo.remainingDays;
  const todayLabel = getTodayLabel();
  const todayWeekday = getTodayWeekday();
  const todayKey = formatDateKey(new Date());
  const ageInfo = getAgeInfo(planner.birthday);

  async function loadPlannerFromDatabase() {
    try {
      const response = await fetch("/api/planner", { cache: "no-store" });
      const data = (await response.json()) as {
        value: StoredPlannerState | null;
      };

      if (data.value) {
        setPlanner(normalizePlanner(data.value));
        return;
      }

      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const nextPlanner = normalizePlanner(
        JSON.parse(stored) as StoredPlannerState,
      );
      setPlanner(nextPlanner);
      await fetch("/api/planner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPlanner),
      });
      window.localStorage.removeItem(storageKey);
    } catch {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      try {
        setPlanner(normalizePlanner(JSON.parse(stored) as StoredPlannerState));
      } catch {
        setPlanner(initialState);
      }
    }
  }

  useEffect(() => {
    loadPlannerFromDatabase().finally(() => setIsReady(true));
    window.addEventListener("focus", loadPlannerFromDatabase);
    window.addEventListener("pageshow", loadPlannerFromDatabase);
    return () => {
      window.removeEventListener("focus", loadPlannerFromDatabase);
      window.removeEventListener("pageshow", loadPlannerFromDatabase);
    };
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(getCurrentTimeValue());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const focusedTask = useMemo(() => {
    if (!focusTarget) return null;
    return planner.priorities.find((task) => task.id === focusTarget.id) || null;
  }, [focusTarget, planner.priorities]);

  const canAddPriority =
    !planner.priorityBatchLocked && planner.priorities.length < 3;
  const todayTimetable =
    planner.timetables.find((timetable) =>
      timetable.weekdays.includes(todayWeekday),
    ) || null;
  const todaysTimetable = todayTimetable?.entries || [];
  const timetableNumberById = useMemo(() => {
    const numberById = new Map<string, number>();
    todaysTimetable
      .filter((entry) => entry.kind === "timetable")
      .forEach((entry, index) => {
        numberById.set(entry.id, index + 1);
      });
    return numberById;
  }, [todaysTimetable]);
  const currentTimetableId = useMemo(() => {
    const nowMinutes = timeToMinutes(currentTime);
    return (
      todaysTimetable
        .filter((entry) => timeToMinutes(entry.time) <= nowMinutes)
        .at(-1)?.id || null
    );
  }, [currentTime, todaysTimetable]);
  const currentTimetableEntry = useMemo(
    () =>
      todaysTimetable.find((entry) => entry.id === currentTimetableId) || null,
    [currentTimetableId, todaysTimetable],
  );
  const activeHabitEntry = useMemo(() => {
    if (
      !currentTimetableEntry ||
      currentTimetableEntry.kind !== "habit" ||
      (currentTimetableEntry.completedDates || []).includes(todayKey)
    ) {
      return null;
    }
    return currentTimetableEntry;
  }, [currentTimetableEntry, todayKey]);
  const visibleTimetable = useMemo(() => {
    const nowMinutes = timeToMinutes(currentTime);
    return todaysTimetable.filter((_, index) => {
      const nextEntry = todaysTimetable[index + 1];
      return !nextEntry || timeToMinutes(nextEntry.time) > nowMinutes;
    });
  }, [currentTime, todaysTimetable]);

  if (!isReady) {
    return <main className="shell" aria-label="読み込み中" />;
  }

  function updateGoal(key: GoalKey, value: string) {
    const periodKey = periodKeys[key];
    setPlanner((current) => ({
      ...current,
      goalsByPeriod: {
        ...current.goalsByPeriod,
        [key]: {
          ...current.goalsByPeriod[key],
          [periodKey]: value,
        },
      },
    }));
  }

  function changePeriod(key: GoalKey, direction: -1 | 1) {
    setPeriodOffsets((current) => ({
      ...current,
      [key]: current[key] + direction,
    }));
  }

  function finishEditing(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur();
      setEditing(null);
    }
  }

  function updatePriorityTitle(id: string, value: string) {
    setPlanner((current) => ({
      ...current,
      priorities: current.priorities.map((task) =>
        task.id === id ? { ...task, title: value } : task,
      ),
    }));
  }

  function completePriority(id: string) {
    setPlanner((current) => {
      const priorities = current.priorities.filter((task) => task.id !== id);
      return {
        ...current,
        priorities,
        priorityBatchLocked:
          priorities.length === 0 ? false : current.priorityBatchLocked,
      };
    });
    if (focusTarget?.id === id) {
      setFocusTarget(null);
    }
  }

  function removePriority(id: string) {
    setPlanner((current) => {
      const priorities = current.priorities.filter((task) => task.id !== id);
      return {
        ...current,
        priorities,
        priorityBatchLocked:
          priorities.length === 0 ? false : current.priorityBatchLocked,
      };
    });
    if (focusTarget?.id === id) {
      setFocusTarget(null);
    }
  }

  function addPriority(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAddPriority || !priorityTitle.trim()) return;
    setPlanner((current) => ({
      ...current,
      priorities: [
        ...current.priorities,
        {
          id: createId("priority"),
          title: priorityTitle.trim(),
          done: false,
        },
      ],
      priorityBatchLocked: current.priorities.length + 1 >= 3,
    }));
    setPriorityTitle("");
  }

  function updateTimetableEntryTitle(
    timetableId: string,
    entryId: string,
    value: string,
  ) {
    setPlanner((current) => ({
      ...current,
      timetables: current.timetables.map((timetable) =>
        timetable.id === timetableId
          ? {
              ...timetable,
              entries: timetable.entries.map((entry) =>
                entry.id === entryId
                  ? {
                      ...entry,
                      dailyTitles: {
                        ...(entry.dailyTitles || {}),
                        [todayKey]: value,
                      },
                    }
                  : entry,
              ),
            }
          : timetable,
      ),
    }));
  }

  function toggleHabitEntry(timetableId: string, entryId: string) {
    setPlanner((current) => ({
      ...current,
      timetables: current.timetables.map((timetable) =>
        timetable.id === timetableId
          ? {
              ...timetable,
              entries: timetable.entries.map((entry) => {
                if (entry.id !== entryId) return entry;
                const completedDates = entry.completedDates || [];
                const isCompleted = completedDates.includes(todayKey);
                return {
                  ...entry,
                  completedDates: isCompleted
                    ? completedDates.filter((date) => date !== todayKey)
                    : [...completedDates, todayKey],
                };
              }),
            }
          : timetable,
      ),
    }));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true" />
          <span>Focus Planner</span>
        </div>
        <div className="headerDateBlock">
          <time className="todayLabel" dateTime={todayLabel}>
            {todayLabel}
          </time>
          {ageInfo && (
            <span className="ageLabel">
              {ageInfo.age}歳 {ageInfo.nextAge}歳まであと
              {ageInfo.daysUntilNextAge}日
            </span>
          )}
        </div>
        <nav className="topbarNav" aria-label="ナビゲーション">
          {session?.user && (
            <span className="userBadge">
              {session.user.name || session.user.email || "ログイン中"}
            </span>
          )}
          <a className="navLink" href="/inbox">
            inbox
          </a>
          <a className="navLink" href="/roadmap">
            memo
          </a>
          <a className="navLink" href="/timetable">
            timetable
          </a>
          <a className="settingsLink" href="/settings" aria-label="設定">
            ⚙
          </a>
          <SignOutButton className="navLink authNavButton" />
        </nav>
      </header>

      <section className="goalNest" aria-label="目標">
        <div className="goalPanel goalYearPanel">
          <div className="goalHeading">
            <span>
              {getGoalLabel("year", periodOffsets.year, periodLabels.year)}
            </span>
            <span className="periodSwitcher">
              <button
                type="button"
                onClick={() => changePeriod("year", -1)}
                aria-label="前年へ"
              >
                &lt;
              </button>
              <span className="periodMeta">
                <time>{periodLabels.year}</time>
                <span>残り{remainingDays.year}日</span>
              </span>
              <button
                type="button"
                onClick={() => changePeriod("year", 1)}
                aria-label="翌年へ"
              >
                &gt;
              </button>
            </span>
          </div>
          <input
            className="goalLineInput"
            value={planner.goalsByPeriod.year[periodKeys.year] || ""}
            onChange={(event) => updateGoal("year", event.target.value)}
          />

          <div className="goalPanel goalMonthPanel">
            <div className="goalHeading">
              <span>
                {getGoalLabel("month", periodOffsets.month, periodLabels.month)}
              </span>
              <span className="periodSwitcher">
                <button
                  type="button"
                  onClick={() => changePeriod("month", -1)}
                  aria-label="前月へ"
                >
                  &lt;
                </button>
                <span className="periodMeta">
                  <time>{periodLabels.month}</time>
                  <span>残り{remainingDays.month}日</span>
                </span>
                <button
                  type="button"
                  onClick={() => changePeriod("month", 1)}
                  aria-label="翌月へ"
                >
                  &gt;
                </button>
              </span>
            </div>
            <input
              className="goalLineInput"
              value={planner.goalsByPeriod.month[periodKeys.month] || ""}
              onChange={(event) => updateGoal("month", event.target.value)}
            />

            <div className="goalPanel goalWeekPanel">
              <div className="goalHeading">
                <span>
                  {getGoalLabel("week", periodOffsets.week, periodLabels.week)}
                </span>
                <span className="periodSwitcher">
                  <button
                    type="button"
                    onClick={() => changePeriod("week", -1)}
                    aria-label="前週へ"
                  >
                    &lt;
                  </button>
                  <span className="periodMeta">
                    <time>{periodLabels.week}</time>
                    <span>残り{remainingDays.week}日</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => changePeriod("week", 1)}
                    aria-label="翌週へ"
                  >
                    &gt;
                  </button>
                </span>
              </div>
              <input
                value={planner.goalsByPeriod.week[periodKeys.week] || ""}
                onChange={(event) => updateGoal("week", event.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {currentTimetableEntry && todayTimetable && (
        <section className="currentTimetablePanel" aria-label="現在の時間割">
          <div className="currentTimetableMeta">
            <span>Now</span>
            <time>{currentTimetableEntry.time}</time>
            {currentTimetableEntry.kind === "timetable" && (
              <span className="periodBadge">
                {timetableNumberById.get(currentTimetableEntry.id)}
              </span>
            )}
          </div>
          {currentTimetableEntry.kind === "timetable" ? (
            <input
              className="currentTimetableInput"
              aria-label={`${currentTimetableEntry.time}の時間割でやること`}
              placeholder="やること"
              value={currentTimetableEntry.dailyTitles?.[todayKey] || ""}
              onChange={(event) =>
                updateTimetableEntryTitle(
                  todayTimetable.id,
                  currentTimetableEntry.id,
                  event.target.value,
                )
              }
            />
          ) : currentTimetableEntry.kind === "habit" ? (
            <label className="currentHabitLabel">
              <input
                type="checkbox"
                checked={(currentTimetableEntry.completedDates || []).includes(
                  todayKey,
                )}
                onChange={() =>
                  toggleHabitEntry(todayTimetable.id, currentTimetableEntry.id)
                }
              />
              <span
                className={
                  (currentTimetableEntry.completedDates || []).includes(todayKey)
                    ? "completed"
                    : ""
                }
              >
                {currentTimetableEntry.title || "名称未設定"}
              </span>
            </label>
          ) : (
            <strong>{currentTimetableEntry.title || "名称未設定"}</strong>
          )}
        </section>
      )}

      <div className="dailyGrid">
        <section className="taskArea" aria-label="最優先タスク">
          <div className="panel priorityPanel">
            <section className="priorityPrimaryColumn" aria-label="最優先タスク">
              <div className="priorityList">
                {planner.priorities.map((task, index) => (
                  <article
                    className={[
                      "priority",
                      index === 0 ? "priorityFirst" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={task.id}
                  >
                    <button
                      className="checkButton"
                      type="button"
                      onClick={() => completePriority(task.id)}
                      aria-label={`${task.title}を完了にする`}
                    >
                      {index + 1}
                    </button>
                    <div className="priorityFields">
                      {task.projectName && (
                        <span className="priorityProjectName">
                          {task.projectName}
                        </span>
                      )}
                      {editing?.kind === "priority" &&
                      editing.id === task.id ? (
                        <input
                          aria-label={`最優先タスク${index + 1}`}
                          autoFocus
                          value={task.title}
                          onBlur={() => setEditing(null)}
                          onKeyDown={finishEditing}
                          onChange={(event) =>
                            updatePriorityTitle(task.id, event.target.value)
                          }
                        />
                      ) : (
                        <strong
                          className="editableTitle"
                          onDoubleClick={() =>
                            setEditing({ kind: "priority", id: task.id })
                          }
                        >
                          {task.title || "無題のタスク"}
                        </strong>
                      )}
                    </div>
                    <button
                      className="focusButton"
                      type="button"
                      onClick={() =>
                        setFocusTarget({ kind: "priority", id: task.id })
                      }
                      aria-label={`${task.title}に集中する`}
                    >
                      focus
                    </button>
                    <button
                      className="iconButton"
                      type="button"
                      onClick={() => removePriority(task.id)}
                      aria-label={`${task.title}を削除`}
                    >
                      ×
                    </button>
                  </article>
                ))}
              </div>

              <form className="taskForm priorityForm" onSubmit={addPriority}>
                <input
                  disabled={!canAddPriority}
                  placeholder={
                    canAddPriority
                      ? `最優先タスク ${planner.priorities.length + 1}/3`
                      : "3つのセットが終わるまで追加できません"
                  }
                  value={priorityTitle}
                  onChange={(event) => setPriorityTitle(event.target.value)}
                />
                <button
                  disabled={!canAddPriority}
                  type="submit"
                  aria-label="最優先タスクを追加"
                >
                  +
                </button>
              </form>
            </section>
          </div>
        </section>

        <section className="timetableSummary panel" aria-label="今日の時間割">
          <div className="timetableSummaryHeader">
            <span>今日の時間割</span>
            <a href="/timetable">編集</a>
          </div>
          <div className="timetableSummaryList">
            {visibleTimetable.length === 0 && (
              <p className="emptyText">今日の時間割はありません。</p>
            )}
            {visibleTimetable.map((entry) => (
              <article
                className={
                  [
                    "timetableSummaryItem",
                    entry.kind === "timetable" ? "hasNumber" : "",
                    entry.id === currentTimetableId ? "current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                key={entry.id}
              >
                <time>{entry.time}</time>
                {entry.kind === "timetable" && (
                  <span className="periodBadge">
                    {timetableNumberById.get(entry.id)}
                  </span>
                )}
                {entry.kind === "timetable" ? (
                  <input
                  className="timetableActionInput"
                  aria-label={`${entry.time}の時間割でやること`}
                  placeholder="やること"
                  value={entry.dailyTitles?.[todayKey] || ""}
                  onChange={(event) =>
                    todayTimetable &&
                      updateTimetableEntryTitle(
                        todayTimetable.id,
                        entry.id,
                        event.target.value,
                      )
                    }
                  />
                ) : entry.kind === "habit" ? (
                  <label className="habitSummaryLabel">
                    <input
                      type="checkbox"
                      checked={(entry.completedDates || []).includes(todayKey)}
                      onChange={() =>
                        todayTimetable &&
                        toggleHabitEntry(todayTimetable.id, entry.id)
                      }
                    />
                    <span
                      className={
                        (entry.completedDates || []).includes(todayKey)
                          ? "completed"
                          : ""
                      }
                    >
                      {entry.title || "名称未設定"}
                    </span>
                  </label>
                ) : (
                  <strong>{entry.title || "名称未設定"}</strong>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>

      {activeHabitEntry && todayTimetable && (
        <div className="habitModalOverlay" role="dialog" aria-modal="true">
          <article className="habitModalCard">
            <time>{activeHabitEntry.time}</time>
            <strong>{activeHabitEntry.title || "名称未設定"}</strong>
            <label className="habitModalCheck">
              <input
                type="checkbox"
                checked={false}
                onChange={() =>
                  toggleHabitEntry(todayTimetable.id, activeHabitEntry.id)
                }
              />
              <span>完了</span>
            </label>
          </article>
        </div>
      )}

      {focusedTask && (
        <div className="focusOverlay" role="dialog" aria-modal="true">
          <article className="focusCard">
            <strong>{focusedTask.title || "無題のタスク"}</strong>
            <div className="focusActions">
              <button type="button" onClick={() => completePriority(focusedTask.id)}>
                完了
              </button>
              <button type="button" onClick={() => setFocusTarget(null)}>
                戻る
              </button>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
