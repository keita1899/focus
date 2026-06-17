"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { SignOutButton } from "./AuthControls";

type GoalKey = "year" | "month" | "week";
type GoalMap = Record<GoalKey, string>;
type PeriodGoalMap = Record<GoalKey, Record<string, string>>;
type PeriodOffsets = Record<GoalKey, number>;

type PriorityTask = {
  id: string;
  title: string;
  done: boolean;
  projectName?: string;
};

type DailyTask = {
  id: string;
  title: string;
  completedDates: string[];
};

type PlannerState = {
  goals: GoalMap;
  goalsByPeriod: PeriodGoalMap;
  birthday: string;
  todayTasks: PriorityTask[];
  dailyTasks: DailyTask[];
};

type StoredPlannerState = Partial<PlannerState>;

type DiaryEntry = {
  id: string;
  date: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type FocusTarget = {
  kind: "priority";
  id: string;
} | null;

type HomeClientProps = {
  initialPlannerValue: StoredPlannerState | null;
  initialDiaryValue: unknown;
};

const plannerStorageKey = "focus-planner-state-v1";
const diaryStorageKey = "diary-v1";

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
  todayTasks: [],
  dailyTasks: [],
};

const goalLabels: Record<GoalKey, string> = {
  year: "今年の目標",
  month: "今月の目標",
  week: "今週の目標",
};
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

function normalizeDiaryEntries(value: unknown): DiaryEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      const item = entry as Partial<DiaryEntry>;
      const now = new Date().toISOString();
      return {
        id: item.id || `diary-${index + 1}`,
        date: item.date || formatDateKey(new Date()),
        body: item.body || "",
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
      };
    })
    .sort((first, second) => second.date.localeCompare(first.date));
}

function getTodayDiaryBody(entries: DiaryEntry[]) {
  return entries.find((entry) => entry.date === formatDateKey(new Date()))?.body || "";
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
  const legacyValue = value as StoredPlannerState & {
    priorities?: PriorityTask[];
    dailyTasks?: DailyTask[];
  };
  const rawTodayTasks = Array.isArray(value.todayTasks)
    ? value.todayTasks
    : Array.isArray(legacyValue.priorities)
      ? legacyValue.priorities
      : initialState.todayTasks;
  const rawDailyTasks = Array.isArray(value.dailyTasks)
    ? value.dailyTasks
    : initialState.dailyTasks;
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
    todayTasks: rawTodayTasks
      .filter((task) => !task.done)
      .map((task, index) => ({
        id: task.id || `today-task-${index + 1}`,
        title: task.title || "",
        done: false,
        projectName: task.projectName || undefined,
      })),
    dailyTasks: rawDailyTasks.map((task, index) => ({
      id: task.id || `daily-task-${index + 1}`,
      title: task.title || "",
      completedDates: Array.isArray(task.completedDates)
        ? task.completedDates
        : [],
    })),
  };
}

export default function HomeClient({
  initialPlannerValue,
  initialDiaryValue,
}: HomeClientProps) {
  const { data: session } = useSession();
  const initialDiaryEntries = useMemo(
    () => normalizeDiaryEntries(initialDiaryValue),
    [initialDiaryValue],
  );
  const [planner, setPlanner] = useState<PlannerState>(() =>
    initialPlannerValue ? normalizePlanner(initialPlannerValue) : initialState,
  );
  const [isReady, setIsReady] = useState(Boolean(initialPlannerValue));
  const [diaryEntries, setDiaryEntries] =
    useState<DiaryEntry[]>(initialDiaryEntries);
  const [todayDiaryBody, setTodayDiaryBody] = useState(() =>
    getTodayDiaryBody(initialDiaryEntries),
  );
  const [isDiaryReady, setIsDiaryReady] = useState(initialDiaryValue !== null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [newTodayTaskTitle, setNewTodayTaskTitle] = useState("");
  const [newDailyTaskTitle, setNewDailyTaskTitle] = useState("");
  const [periodOffsets, setPeriodOffsets] = useState<PeriodOffsets>({
    year: 0,
    month: 0,
    week: 0,
  });
  const periodInfo = getPeriodInfo(periodOffsets);
  const periodLabels = periodInfo.labels;
  const periodKeys = periodInfo.keys;
  const remainingDays = periodInfo.remainingDays;
  const todayLabel = getTodayLabel();
  const todayKey = formatDateKey(new Date());
  const ageInfo = getAgeInfo(planner.birthday);

  useEffect(() => {
    if (initialPlannerValue) return;

    async function migrateLocalPlanner() {
      const stored = window.localStorage.getItem(plannerStorageKey);
      if (!stored) return;

      try {
        const nextPlanner = normalizePlanner(
          JSON.parse(stored) as StoredPlannerState,
        );
        setPlanner(nextPlanner);
        await fetch("/api/planner", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextPlanner),
        });
        window.localStorage.removeItem(plannerStorageKey);
      } catch {
        setPlanner(initialState);
      }
    }

    migrateLocalPlanner().finally(() => setIsReady(true));
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
    if (initialDiaryValue !== null) return;

    async function loadDiary() {
      try {
        const response = await fetch("/api/diary", { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        const dbEntries = normalizeDiaryEntries(data.value);

        if (dbEntries.length > 0) {
          setDiaryEntries(dbEntries);
          setTodayDiaryBody(getTodayDiaryBody(dbEntries));
          return;
        }

        const stored = window.localStorage.getItem(diaryStorageKey);
        if (!stored) return;
        const migratedEntries = normalizeDiaryEntries(JSON.parse(stored));
        setDiaryEntries(migratedEntries);
        setTodayDiaryBody(getTodayDiaryBody(migratedEntries));
        await fetch("/api/diary", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(migratedEntries),
        });
        window.localStorage.removeItem(diaryStorageKey);
      } catch {
        const stored = window.localStorage.getItem(diaryStorageKey);
        if (!stored) return;
        const localEntries = normalizeDiaryEntries(JSON.parse(stored));
        setDiaryEntries(localEntries);
        setTodayDiaryBody(getTodayDiaryBody(localEntries));
      }
    }

    loadDiary().finally(() => setIsDiaryReady(true));
  }, [initialDiaryValue]);

  useEffect(() => {
    if (!isDiaryReady) return;
    fetch("/api/diary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diaryEntries),
    }).catch(() => undefined);
  }, [diaryEntries, isDiaryReady]);

  const focusedTask = useMemo(() => {
    if (!focusTarget) return null;
    return planner.todayTasks.find((task) => task.id === focusTarget.id) || null;
  }, [focusTarget, planner.todayTasks]);
  const incompleteDailyTasks = planner.dailyTasks.filter(
    (task) => !task.completedDates.includes(todayKey),
  );
  const completedDailyTasks = planner.dailyTasks.filter((task) =>
    task.completedDates.includes(todayKey),
  );

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

  function addTodayTask() {
    const title = newTodayTaskTitle.trim();
    if (!title) return;
    setPlanner((current) => ({
      ...current,
      todayTasks: [
        ...current.todayTasks,
        { id: createId("today-task"), title, done: false },
      ],
    }));
    setNewTodayTaskTitle("");
  }

  function updateTodayTaskTitle(id: string, title: string) {
    setPlanner((current) => ({
      ...current,
      todayTasks: current.todayTasks.map((task) =>
        task.id === id ? { ...task, title } : task,
      ),
    }));
  }

  function completeTodayTask(id: string) {
    setPlanner((current) => ({
      ...current,
      todayTasks: current.todayTasks.filter((task) => task.id !== id),
    }));
    if (focusTarget?.id === id) {
      setFocusTarget(null);
    }
  }

  function completePriority(id: string) {
    completeTodayTask(id);
  }

  function addDailyTask() {
    const title = newDailyTaskTitle.trim();
    if (!title) return;
    setPlanner((current) => ({
      ...current,
      dailyTasks: [
        ...current.dailyTasks,
        { id: createId("daily-task"), title, completedDates: [] },
      ],
    }));
    setNewDailyTaskTitle("");
  }

  function updateDailyTaskTitle(id: string, title: string) {
    setPlanner((current) => ({
      ...current,
      dailyTasks: current.dailyTasks.map((task) =>
        task.id === id ? { ...task, title } : task,
      ),
    }));
  }

  function toggleDailyTask(id: string) {
    setPlanner((current) => ({
      ...current,
      dailyTasks: current.dailyTasks.map((task) => {
        if (task.id !== id) return task;
        const isCompleted = task.completedDates.includes(todayKey);
        return {
          ...task,
          completedDates: isCompleted
            ? task.completedDates.filter((date) => date !== todayKey)
            : [...task.completedDates, todayKey],
        };
      }),
    }));
  }

  function removeDailyTask(id: string) {
    setPlanner((current) => ({
      ...current,
      dailyTasks: current.dailyTasks.filter((task) => task.id !== id),
    }));
  }

  function updateTodayDiary(body: string) {
    const now = new Date().toISOString();
    setTodayDiaryBody(body);
    setDiaryEntries((current) => {
      const todayEntry = current.find((entry) => entry.date === todayKey);
      if (todayEntry) {
        return current
          .map((entry) =>
            entry.id === todayEntry.id ? { ...entry, body, updatedAt: now } : entry,
          )
          .sort((first, second) => second.date.localeCompare(first.date));
      }

      return [
        {
          id: createId("diary"),
          date: todayKey,
          body,
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ].sort((first, second) => second.date.localeCompare(first.date));
    });
  }

  return (
    <main className="shell homeShell">
      <header className="topbar">
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
        <div className="topbarLinks">
          <nav className="topbarNav" aria-label="ナビゲーション">
            <a className="navLink" href="/roadmap">
              roadmap
            </a>
            <a className="navLink" href="/notes">
              notes
            </a>
            <a className="navLink" href="/diary">
              diary
            </a>
          </nav>
          <div className="topbarAuth">
            {session?.user && (
              <span className="userBadge">
                {session.user.name || session.user.email || "ログイン中"}
              </span>
            )}
            <a className="settingsLink" href="/settings" aria-label="設定">
              ⚙
            </a>
            <SignOutButton className="navLink authNavButton" />
          </div>
        </div>
      </header>

      <section className="homeColumns" aria-label="今日の管理">
        <section className="homeColumn goalColumn" aria-label="目標">
          <h2>目標</h2>
          <div className="goalNest">
            <section className="goalPanel goalYearPanel">
              <div className="goalHeading">
                <span>
                  {getGoalLabel("year", periodOffsets.year, periodLabels.year)}
                </span>
                <span className="periodSwitcher">
                  <button
                    type="button"
                    onClick={() => changePeriod("year", -1)}
                    aria-label="年の目標を前へ"
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
                    aria-label="年の目標を次へ"
                  >
                    &gt;
                  </button>
                </span>
              </div>
              <input
                className="goalLineInput"
                aria-label="年の目標"
                value={planner.goalsByPeriod.year[periodKeys.year] || ""}
                onChange={(event) => updateGoal("year", event.target.value)}
              />

              <section className="goalPanel goalMonthPanel">
                <div className="goalHeading">
                  <span>
                    {getGoalLabel(
                      "month",
                      periodOffsets.month,
                      periodLabels.month,
                    )}
                  </span>
                  <span className="periodSwitcher">
                    <button
                      type="button"
                      onClick={() => changePeriod("month", -1)}
                      aria-label="月の目標を前へ"
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
                      aria-label="月の目標を次へ"
                    >
                      &gt;
                    </button>
                  </span>
                </div>
                <input
                  className="goalLineInput"
                  aria-label="月の目標"
                  value={planner.goalsByPeriod.month[periodKeys.month] || ""}
                  onChange={(event) => updateGoal("month", event.target.value)}
                />

                <section className="goalPanel goalWeekPanel">
                  <div className="goalHeading">
                    <span>
                      {getGoalLabel(
                        "week",
                        periodOffsets.week,
                        periodLabels.week,
                      )}
                    </span>
                    <span className="periodSwitcher">
                      <button
                        type="button"
                        onClick={() => changePeriod("week", -1)}
                        aria-label="週の目標を前へ"
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
                        aria-label="週の目標を次へ"
                      >
                        &gt;
                      </button>
                    </span>
                  </div>
                  <input
                    className="goalWeekInput"
                    aria-label="週の目標"
                    value={planner.goalsByPeriod.week[periodKeys.week] || ""}
                    onChange={(event) => updateGoal("week", event.target.value)}
                  />
                </section>
              </section>
            </section>
          </div>
        </section>

        <section className="homeColumn taskColumn" aria-label="今日やることリスト">
          <h2>今日やることリスト</h2>
          <form
            className="taskForm"
            onSubmit={(event) => {
              event.preventDefault();
              addTodayTask();
            }}
          >
            <input
              aria-label="今日やることを追加"
              placeholder="今日やること"
              value={newTodayTaskTitle}
              onChange={(event) => setNewTodayTaskTitle(event.target.value)}
            />
            <button type="submit" aria-label="今日やることを追加">
              +
            </button>
          </form>
          <div className="taskList">
            {planner.todayTasks.length === 0 && (
              <p className="emptyText">今日やることはありません。</p>
            )}
            {planner.todayTasks.map((task) => (
              <article
                className="taskItem"
                key={task.id}
              >
                <button
                  className="checkButton"
                  type="button"
                  onClick={() => completeTodayTask(task.id)}
                  aria-label={`${task.title || "無題のタスク"}を完了`}
                >
                  ✓
                </button>
                <input
                  aria-label="今日やること"
                  value={task.title}
                  onChange={(event) =>
                    updateTodayTaskTitle(task.id, event.target.value)
                  }
                />
                <div className="priorityActions">
                  <button
                    className="focusButton"
                    type="button"
                    onClick={() =>
                      setFocusTarget({ kind: "priority", id: task.id })
                    }
                    aria-label={`${task.title || "無題のタスク"}に集中する`}
                  >
                    focus
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="homeColumn dailyColumn" aria-label="毎日やることリスト">
          <h2>毎日やることリスト</h2>
          <form
            className="taskForm"
            onSubmit={(event) => {
              event.preventDefault();
              addDailyTask();
            }}
          >
            <input
              aria-label="毎日やることを追加"
              placeholder="毎日やること"
              value={newDailyTaskTitle}
              onChange={(event) => setNewDailyTaskTitle(event.target.value)}
            />
            <button type="submit" aria-label="毎日やることを追加">
              +
            </button>
          </form>
          <div className="taskList">
            {planner.dailyTasks.length === 0 && (
              <p className="emptyText">毎日やることはありません。</p>
            )}
            {incompleteDailyTasks.map((task) => (
              <article className="taskItem" key={task.id}>
                <button
                  className="checkButton"
                  type="button"
                  onClick={() => toggleDailyTask(task.id)}
                  aria-label={`${task.title || "無題のタスク"}を完了`}
                >
                  ✓
                </button>
                <input
                  aria-label="毎日やること"
                  value={task.title}
                  onChange={(event) =>
                    updateDailyTaskTitle(task.id, event.target.value)
                  }
                />
                <button
                  className="iconButton"
                  type="button"
                  onClick={() => removeDailyTask(task.id)}
                  aria-label={`${task.title || "無題のタスク"}を削除`}
                >
                  ×
                </button>
              </article>
            ))}
            {completedDailyTasks.length > 0 && (
              <div className="completedTaskGroup">
                <span className="completedTaskGroupLabel">完了済み</span>
                {completedDailyTasks.map((task) => (
                  <article className="taskItem done" key={task.id}>
                    <button
                      className="checkButton"
                      type="button"
                      onClick={() => toggleDailyTask(task.id)}
                      aria-label={`${task.title || "無題のタスク"}の完了を戻す`}
                    >
                      ✓
                    </button>
                    <input
                      aria-label="毎日やること"
                      value={task.title}
                      onChange={(event) =>
                        updateDailyTaskTitle(task.id, event.target.value)
                      }
                    />
                    <button
                      className="iconButton"
                      type="button"
                      onClick={() => removeDailyTask(task.id)}
                      aria-label={`${task.title || "無題のタスク"}を削除`}
                    >
                      ×
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="homeDiaryPanel" aria-label="今日の日記">
        <div className="homeDiaryHeader">
          <h2>今日の日記</h2>
          <time dateTime={todayKey}>{todayLabel}</time>
        </div>
        <textarea
          aria-label="今日の日記本文"
          placeholder="今日の記録"
          value={todayDiaryBody}
          onChange={(event) => updateTodayDiary(event.target.value)}
        />
      </section>

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
