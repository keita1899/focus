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

type WeeklyTask = {
  id: string;
  title: string;
  weekday: number;
  completedWeeks: string[];
};

type AchievementTask = {
  id: string;
  title: string;
  done: boolean;
  parentId?: string;
  year: number;
};

type PlannerState = {
  goals: GoalMap;
  goalsByPeriod: PeriodGoalMap;
  birthday: string;
  achievementTasks: AchievementTask[];
  importantTodayTask: PriorityTask | null;
  todayTasks: PriorityTask[];
  dailyTasks: DailyTask[];
  weeklyTasks: WeeklyTask[];
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

type TaskEditTarget =
  | { kind: "achievement"; id: string }
  | { kind: "important"; id: string }
  | { kind: "today"; id: string }
  | { kind: "weekly"; id: string }
  | { kind: "daily"; id: string }
  | null;

type HomeClientProps = {
  initialPlannerValue: StoredPlannerState | null;
  initialDiaryValue: unknown;
};

const plannerStorageKey = "focus-planner-state-v1";
const diaryStorageKey = "diary-v1";
const achievementExpandedStorageKey = "focus-achievement-expanded-v1";
const currentYear = new Date().getFullYear();
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0] as const;
const weekdayLabels: Record<number, string> = {
  0: "日",
  1: "月",
  2: "火",
  3: "水",
  4: "木",
  5: "金",
  6: "土",
};

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
  achievementTasks: [],
  importantTodayTask: null,
  todayTasks: [],
  dailyTasks: [],
  weeklyTasks: [],
};

function getAchievementYearLabel(offset: number) {
  return `${currentYear + offset}年`;
}

function getWeekdayLabel(weekday: number) {
  return `${weekdayLabels[weekday]}曜日`;
}

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

function getCurrentWeekKey() {
  return formatDateKey(getWeekStartDate(0));
}

function getWeeklySlotKey(weekKey: string, weekday: number) {
  return `${weekKey}-${weekday}`;
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
    achievementTasks?: AchievementTask[];
    importantTodayTask?: PriorityTask | null;
    dailyTasks?: DailyTask[];
    weeklyTasks?: WeeklyTask[];
  };
  const rawAchievementTasks = Array.isArray(legacyValue.achievementTasks)
    ? legacyValue.achievementTasks
    : initialState.achievementTasks;
  const rawTodayTasks = Array.isArray(value.todayTasks)
    ? value.todayTasks
    : Array.isArray(legacyValue.priorities)
      ? legacyValue.priorities
      : initialState.todayTasks;
  const rawImportantTask =
    legacyValue.importantTodayTask ||
    (rawTodayTasks.length > 0 ? rawTodayTasks[0] : null);
  const rawInboxTasks = legacyValue.importantTodayTask
    ? rawTodayTasks
    : rawTodayTasks.slice(rawImportantTask ? 1 : 0);
  const rawDailyTasks = Array.isArray(value.dailyTasks)
    ? value.dailyTasks
    : initialState.dailyTasks;
  const rawWeeklyTasks = Array.isArray(legacyValue.weeklyTasks)
    ? legacyValue.weeklyTasks
    : initialState.weeklyTasks;
  const fallbackWeekday = new Date().getDay();
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
    achievementTasks: rawAchievementTasks.map((task, index) => ({
      id: task.id || `achievement-task-${index + 1}`,
      title: task.title || "",
      done: Boolean(task.done),
      parentId: task.parentId || undefined,
      year: typeof task.year === "number" ? task.year : currentYear,
    })),
    importantTodayTask: rawImportantTask
      ? {
          id: rawImportantTask.id || "important-task",
          title: rawImportantTask.title || "",
          done: false,
          projectName: rawImportantTask.projectName || undefined,
        }
      : null,
    todayTasks: rawInboxTasks
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
    weeklyTasks: rawWeeklyTasks.map((task, index) => ({
      id: task.id || `weekly-task-${index + 1}`,
      title: task.title || "",
      weekday: (() => {
        const legacyTask = task as {
          weekday?: unknown;
          weekdays?: unknown[];
        };
        if (
          typeof legacyTask.weekday === "number" &&
          Number.isInteger(legacyTask.weekday) &&
          legacyTask.weekday >= 0 &&
          legacyTask.weekday <= 6
        ) {
          return legacyTask.weekday;
        }
        const legacyWeekday = legacyTask.weekdays?.[0];
        if (
          typeof legacyWeekday === "number" &&
          Number.isInteger(legacyWeekday) &&
          legacyWeekday >= 0 &&
          legacyWeekday <= 6
        ) {
          return legacyWeekday;
        }
        return fallbackWeekday;
      })(),
      completedWeeks: (() => {
        const legacyTask = task as {
          completedWeeks?: unknown[];
          completedSlots?: unknown[];
        };
        if (Array.isArray(legacyTask.completedWeeks)) {
          return legacyTask.completedWeeks.filter(
            (slot): slot is string => typeof slot === "string",
          );
        }
        if (Array.isArray(legacyTask.completedSlots)) {
          return legacyTask.completedSlots.filter(
            (slot): slot is string => typeof slot === "string",
          );
        }
        return [];
      })(),
    })),
  };
}

export default function HomeClient({
  initialPlannerValue,
  initialDiaryValue,
}: HomeClientProps) {
  const { data: session } = useSession();
  const [todayKey, setTodayKey] = useState(() => formatDateKey(new Date()));
  const [todayLabel, setTodayLabel] = useState(() => getTodayLabel());
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
  const [editingTaskTarget, setEditingTaskTarget] =
    useState<TaskEditTarget>(null);
  const [newAchievementTitle, setNewAchievementTitle] = useState("");
  const [newAchievementChildTitles, setNewAchievementChildTitles] = useState<
    Record<string, string>
  >({});
  const [expandedAchievementParents, setExpandedAchievementParents] = useState<
    Record<string, boolean>
  >(() => {
    if (typeof window === "undefined") return {};

    try {
      const stored = window.localStorage.getItem(achievementExpandedStorageKey);
      if (!stored) return {};
      const parsed = JSON.parse(stored) as Record<string, boolean>;
      return Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => Boolean(value)),
      );
    } catch {
      return {};
    }
  });
  const [achievementYearOffset, setAchievementYearOffset] = useState(0);
  const [newImportantTaskTitle, setNewImportantTaskTitle] = useState("");
  const [newTodayTaskTitle, setNewTodayTaskTitle] = useState("");
  const [newDailyTaskTitle, setNewDailyTaskTitle] = useState("");
  const [newWeeklyTaskTitle, setNewWeeklyTaskTitle] = useState("");
  const [selectedWeeklyWeekday, setSelectedWeeklyWeekday] = useState(
    () => new Date().getDay(),
  );
  const [periodOffsets, setPeriodOffsets] = useState<PeriodOffsets>({
    year: 0,
    month: 0,
    week: 0,
  });
  const periodInfo = getPeriodInfo(periodOffsets);
  const periodLabels = periodInfo.labels;
  const periodKeys = periodInfo.keys;
  const remainingDays = periodInfo.remainingDays;
  const todayWeekday = new Date().getDay();
  const currentWeekKey = getCurrentWeekKey();
  const achievementYear = currentYear + achievementYearOffset;
  const currentWeeklySlotKey = getWeeklySlotKey(currentWeekKey, selectedWeeklyWeekday);
  const ageInfo = getAgeInfo(planner.birthday);

  useEffect(() => {
    let timeoutId: number | null = null;

    const scheduleNextTick = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);

      timeoutId = window.setTimeout(() => {
        setTodayKey(formatDateKey(new Date()));
        setTodayLabel(getTodayLabel());
        scheduleNextTick();
      }, Math.max(0, nextMidnight.getTime() - now.getTime()));
    };

    scheduleNextTick();
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

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

  useEffect(() => {
    setTodayDiaryBody(getTodayDiaryBody(diaryEntries));
  }, [diaryEntries, todayKey]);

  useEffect(() => {
    document
      .querySelectorAll<HTMLTextAreaElement>(
        ".taskList textarea, .todayImportantSection textarea",
      )
      .forEach((textarea) => {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      });
  }, [planner, expandedAchievementParents]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        achievementExpandedStorageKey,
        JSON.stringify(expandedAchievementParents),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [expandedAchievementParents]);

  const focusedTask = useMemo(() => {
    if (!focusTarget) return null;
    if (planner.importantTodayTask?.id === focusTarget.id) {
      return planner.importantTodayTask;
    }
    return planner.todayTasks.find((task) => task.id === focusTarget.id) || null;
  }, [focusTarget, planner.importantTodayTask, planner.todayTasks]);
  const achievementParents = planner.achievementTasks.filter(
    (task) => !task.parentId && task.year === achievementYear,
  );
  const achievementChildrenByParent = planner.achievementTasks.reduce<
    Record<string, AchievementTask[]>
  >((groups, task) => {
    if (!task.parentId || task.year !== achievementYear) return groups;
    return {
      ...groups,
      [task.parentId]: [...(groups[task.parentId] || []), task],
    };
  }, {});

  function taskEditKey(target: Exclude<TaskEditTarget, null>) {
    return `${target.kind}:${target.id}`;
  }

  function isTaskBeingEdited(target: Exclude<TaskEditTarget, null>) {
    return (
      editingTaskTarget !== null &&
      taskEditKey(editingTaskTarget) === taskEditKey(target)
    );
  }

  function beginTaskEdit(target: Exclude<TaskEditTarget, null>) {
    setEditingTaskTarget(target);
  }

  function finishTaskEdit(target: Exclude<TaskEditTarget, null>) {
    setEditingTaskTarget((current) =>
      current !== null && taskEditKey(current) === taskEditKey(target)
        ? null
        : current,
    );
  }

  function handleTaskEditKeyDown(
    event: { key: string; preventDefault: () => void; currentTarget: { blur: () => void } },
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  function addAchievementTask(parentId?: string) {
    const title = parentId
      ? newAchievementChildTitles[parentId]?.trim()
      : newAchievementTitle.trim();
    if (!title) return;

    setPlanner((current) => ({
      ...current,
      achievementTasks: [
        ...current.achievementTasks,
        {
          id: createId("achievement-task"),
          title,
          done: false,
          parentId,
          year: achievementYear,
        },
      ],
    }));

    if (parentId) {
      setExpandedAchievementParents((current) => ({
        ...current,
        [parentId]: true,
      }));
      setNewAchievementChildTitles((current) => ({
        ...current,
        [parentId]: "",
      }));
      return;
    }

    setNewAchievementTitle("");
  }

  function changeAchievementYear(direction: -1 | 1) {
    setAchievementYearOffset((current) => current + direction);
  }

  function updateAchievementTaskTitle(id: string, title: string) {
    setPlanner((current) => ({
      ...current,
      achievementTasks: current.achievementTasks.map((task) =>
        task.id === id ? { ...task, title } : task,
      ),
    }));
  }

  function toggleAchievementTask(id: string) {
    setPlanner((current) => ({
      ...current,
      achievementTasks: current.achievementTasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    }));
  }

  function removeAchievementTask(id: string) {
    setPlanner((current) => ({
      ...current,
      achievementTasks: current.achievementTasks.filter(
        (task) => task.id !== id && task.parentId !== id,
      ),
    }));
    setExpandedAchievementParents((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setNewAchievementChildTitles((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  }

  function toggleAchievementChildren(parentId: string) {
    setExpandedAchievementParents((current) => ({
      ...current,
      [parentId]: !current[parentId],
    }));
  }

  function updateNewAchievementChildTitle(parentId: string, title: string) {
    setNewAchievementChildTitles((current) => ({
      ...current,
      [parentId]: title,
    }));
  }

  function renderAchievementTask(
    task: AchievementTask,
    isChild = false,
    isParent = false,
  ) {
    const editTarget = { kind: "achievement", id: task.id } as const;
    const isEditing = isTaskBeingEdited(editTarget);
    const titleLabel = isChild ? "達成リストの子項目" : "達成リスト";
    return (
      <article
        className={
          task.done
            ? isParent
              ? "taskItem achievementItem achievementParentItem done"
              : "taskItem achievementItem done"
            : isParent
              ? "taskItem achievementItem achievementParentItem"
              : "taskItem achievementItem"
        }
        key={task.id}
      >
        <button
          className="checkButton"
          type="button"
          onClick={() => toggleAchievementTask(task.id)}
          aria-label={`${task.title || "無題の達成項目"}の完了を切り替え`}
        >
          ✓
        </button>
        {isEditing ? (
          <textarea
            aria-label={titleLabel}
            value={task.title}
            onChange={(event) =>
              updateAchievementTaskTitle(task.id, event.target.value)
            }
            onKeyDown={handleTaskEditKeyDown}
            onBlur={() => finishTaskEdit(editTarget)}
            rows={1}
          />
        ) : (
          <div
            className="taskTitleView"
            role="textbox"
            aria-label={titleLabel}
            aria-readonly="true"
            tabIndex={0}
            onDoubleClick={() => beginTaskEdit(editTarget)}
          >
            {task.title || " "}
          </div>
        )}
        <button
          className="iconButton"
          type="button"
          onClick={() => removeAchievementTask(task.id)}
          aria-label={`${task.title || "無題の達成項目"}を削除`}
        >
          ×
        </button>
        {isParent && (
          <button
            className={
              expandedAchievementParents[task.id] ?? false
                ? "achievementDisclosure expanded"
                : "achievementDisclosure"
            }
            type="button"
            onClick={() => toggleAchievementChildren(task.id)}
            aria-expanded={expandedAchievementParents[task.id] ?? false}
            aria-label={`${task.title || "達成項目"}の子項目を開閉`}
            title="開閉"
          >
            ⌄
          </button>
        )}
      </article>
    );
  }

  function renderAchievementGroup(task: AchievementTask) {
    const children = achievementChildrenByParent[task.id] || [];
    const isExpanded = expandedAchievementParents[task.id] ?? false;
    return (
      <div className="achievementGroup" key={task.id}>
        {renderAchievementTask(task, false, true)}
        {children.length > 0 && isExpanded && (
          <div className="achievementChildren">
            {children.map((child) => renderAchievementTask(child, true))}
          </div>
        )}
        {isExpanded && (
          <form
            className="achievementGhostForm"
            onSubmit={(event) => {
              event.preventDefault();
              addAchievementTask(task.id);
            }}
          >
            <input
              aria-label={`${task.title || "達成項目"}の子項目を追加`}
              placeholder="子項目を追加"
              value={newAchievementChildTitles[task.id] || ""}
              onChange={(event) =>
                updateNewAchievementChildTitle(task.id, event.target.value)
              }
            />
            <button type="submit" aria-label="子項目を追加" title="追加">
              +
            </button>
          </form>
        )}
      </div>
    );
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

  function addImportantTask() {
    const title = newImportantTaskTitle.trim();
    if (!title) return;
    setPlanner((current) => ({
      ...current,
      importantTodayTask: {
        id: createId("important-task"),
        title,
        done: false,
      },
    }));
    setNewImportantTaskTitle("");
  }

  function updateImportantTaskTitle(title: string) {
    setPlanner((current) => {
      if (!current.importantTodayTask) return current;
      return {
        ...current,
        importantTodayTask: {
          ...current.importantTodayTask,
          title,
        },
      };
    });
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
    if (planner.importantTodayTask?.id === id) {
      completeImportantTask(id);
      return;
    }
    completeTodayTask(id);
  }

  function completeImportantTask(id: string) {
    setPlanner((current) => ({ ...current, importantTodayTask: null }));
    if (focusTarget?.id === id) {
      setFocusTarget(null);
    }
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

  function addWeeklyTask() {
    const title = newWeeklyTaskTitle.trim();
    if (!title) return;
    setPlanner((current) => ({
      ...current,
      weeklyTasks: [
        ...current.weeklyTasks,
        {
          id: createId("weekly-task"),
          title,
          weekday: selectedWeeklyWeekday,
          completedWeeks: [],
        },
      ],
    }));
    setNewWeeklyTaskTitle("");
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

  function updateWeeklyTaskTitle(id: string, title: string) {
    setPlanner((current) => ({
      ...current,
      weeklyTasks: current.weeklyTasks.map((task) =>
        task.id === id ? { ...task, title } : task,
      ),
    }));
  }

  function toggleSelectedWeeklyWeekday(weekday: number) {
    setSelectedWeeklyWeekday(weekday);
  }

  function toggleWeeklyTask(id: string) {
    setPlanner((current) => ({
      ...current,
      weeklyTasks: current.weeklyTasks.map((task) => {
        if (task.id !== id) return task;
        if (task.weekday !== selectedWeeklyWeekday) return task;
        const isCompleted = task.completedWeeks.includes(currentWeeklySlotKey);
        return {
          ...task,
          completedWeeks: isCompleted
            ? task.completedWeeks.filter((slot) => slot !== currentWeeklySlotKey)
            : [...task.completedWeeks, currentWeeklySlotKey],
        };
      }),
    }));
  }

  function removeWeeklyTask(id: string) {
    setPlanner((current) => ({
      ...current,
      weeklyTasks: current.weeklyTasks.filter((task) => task.id !== id),
    }));
  }

  function renderWeekdayToggles(
    selectedWeekday: number,
    onToggle: (weekday: number) => void,
  ) {
    return (
      <div className="weekdayToggleRow">
        {weekdayOrder.map((weekday) => {
          const isActive = selectedWeekday === weekday;
          return (
            <button
              key={weekday}
              className={isActive ? "weekdayToggle active" : "weekdayToggle"}
              type="button"
              onClick={() => onToggle(weekday)}
              aria-pressed={isActive}
              aria-label={getWeekdayLabel(weekday)}
            >
              {weekdayLabels[weekday]}
            </button>
          );
        })}
      </div>
    );
  }

  function renderWeeklyTask(task: WeeklyTask) {
    const editTarget = { kind: "weekly", id: task.id } as const;
    const isEditing = isTaskBeingEdited(editTarget);
    const isTodayScheduled = task.weekday === selectedWeeklyWeekday;
    const isCompleted = task.completedWeeks.includes(currentWeeklySlotKey);
    return (
      <article
        className={isCompleted ? "taskItem done weeklyItem" : "taskItem weeklyItem"}
        key={task.id}
      >
        <button
          className="checkButton"
          type="button"
          onClick={() => toggleWeeklyTask(task.id)}
          disabled={!isTodayScheduled}
          aria-label={
            isTodayScheduled
              ? `${task.title || "無題のタスク"}を今週分完了`
              : `${task.title || "無題のタスク"}は今日は対象外`
          }
        >
          ✓
        </button>
        {isEditing ? (
          <textarea
            aria-label="毎週やること"
            value={task.title}
            onChange={(event) =>
              updateWeeklyTaskTitle(task.id, event.target.value)
            }
            onKeyDown={handleTaskEditKeyDown}
            onBlur={() => finishTaskEdit(editTarget)}
            rows={1}
          />
        ) : (
          <div
            className="taskTitleView"
            role="textbox"
            aria-label="毎週やること"
            aria-readonly="true"
            tabIndex={0}
            onDoubleClick={() => beginTaskEdit(editTarget)}
          >
            {task.title || " "}
          </div>
        )}
        <button
          className="iconButton"
          type="button"
          onClick={() => removeWeeklyTask(task.id)}
          aria-label={`${task.title || "無題のタスク"}を削除`}
        >
          ×
        </button>
        <div className="weeklyItemWeekdays">
          <span className="weeklyItemDayBadge">{getWeekdayLabel(task.weekday)}</span>
        </div>
      </article>
    );
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
          {session?.user && (
            <span className="userBadge">
              {session.user.name || session.user.email || "ログイン中"}
            </span>
          )}
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
            <a className="settingsLink" href="/settings" aria-label="設定">
              ⚙
            </a>
            <SignOutButton className="navLink authNavButton" />
          </div>
        </div>
      </header>

      <section className="homeColumns" aria-label="今日の管理">
        <section className="homeColumn goalColumn" aria-label="目標">
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

        <section className="homeColumn achievementColumn" aria-label="達成リスト">
          <div className="sectionHeader achievementSectionHeader">
            <h2>達成リスト</h2>
            <span className="periodSwitcher achievementYearSwitcher">
              <button
                type="button"
                onClick={() => changeAchievementYear(-1)}
                aria-label="達成リストの年を前へ"
              >
                &lt;
              </button>
              <span className="periodMeta">
                <time>{getAchievementYearLabel(achievementYearOffset)}</time>
              </span>
              <button
                type="button"
                onClick={() => changeAchievementYear(1)}
                aria-label="達成リストの年を次へ"
              >
                &gt;
              </button>
            </span>
          </div>
          <form
            className="taskForm"
            onSubmit={(event) => {
              event.preventDefault();
              addAchievementTask();
            }}
          >
            <input
              aria-label="達成リストを追加"
              placeholder="達成したいこと"
              value={newAchievementTitle}
              onChange={(event) => setNewAchievementTitle(event.target.value)}
            />
            <button type="submit" aria-label="達成リストを追加">
              +
            </button>
          </form>
          <div className="taskList">
            {achievementParents.length === 0 && (
              <p className="emptyText">達成リストはありません。</p>
            )}
            {achievementParents.map(renderAchievementGroup)}
          </div>
        </section>

        <section className="homeColumn taskColumn" aria-label="今日やることリスト">
          <h2>今日やることリスト</h2>
          {(() => {
            const importantTask = planner.importantTodayTask;
            const importantEditTarget = importantTask
              ? ({ kind: "important", id: importantTask.id } as const)
              : null;
            const isImportantEditing = importantEditTarget
              ? isTaskBeingEdited(importantEditTarget)
              : false;
            return (
              <section className="todayImportantSection" aria-label="重要なタスク">
                <div className="sectionHeader">
                  <h3>重要なタスク</h3>
                </div>
                {importantTask ? (
                  <article className="taskItem taskItemImportant">
                    <button
                      className="checkButton"
                      type="button"
                      onClick={() => completeImportantTask(importantTask.id)}
                      aria-label={`${importantTask.title || "重要なタスク"}を完了`}
                    >
                      ✓
                    </button>
                    {isImportantEditing ? (
                      <textarea
                        aria-label="重要なタスク"
                        value={importantTask.title}
                        onChange={(event) =>
                          updateImportantTaskTitle(event.target.value)
                        }
                        onKeyDown={handleTaskEditKeyDown}
                        onBlur={() => finishTaskEdit(importantEditTarget!)}
                        rows={1}
                      />
                    ) : (
                      <div
                        className="taskTitleView"
                        role="textbox"
                        aria-label="重要なタスク"
                        aria-readonly="true"
                        tabIndex={0}
                        onDoubleClick={() => beginTaskEdit(importantEditTarget!)}
                      >
                        {importantTask.title || " "}
                      </div>
                    )}
                    <div className="priorityActions">
                      <button
                        className="focusButton"
                        type="button"
                        onClick={() =>
                          setFocusTarget({
                            kind: "priority",
                            id: importantTask.id,
                          })
                        }
                        aria-label={`${importantTask.title || "重要なタスク"}に集中する`}
                      >
                        focus
                      </button>
                    </div>
                  </article>
                ) : (
                  <form
                    className="taskForm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addImportantTask();
                    }}
                  >
                    <input
                      aria-label="重要なタスクを追加"
                      placeholder="重要なタスク"
                      value={newImportantTaskTitle}
                      onChange={(event) =>
                        setNewImportantTaskTitle(event.target.value)
                      }
                    />
                    <button type="submit" aria-label="重要なタスクを追加">
                      +
                    </button>
                  </form>
                )}
              </section>
            );
          })()}

          <section className="todayInboxSection" aria-label="Inboxタスク">
            <div className="sectionHeader">
              <h3>Inbox</h3>
            </div>
            <form
              className="taskForm"
              onSubmit={(event) => {
                event.preventDefault();
                addTodayTask();
              }}
            >
              <input
                aria-label="Inboxタスクを追加"
                placeholder="Inboxタスク"
                value={newTodayTaskTitle}
                onChange={(event) => setNewTodayTaskTitle(event.target.value)}
              />
              <button type="submit" aria-label="Inboxタスクを追加">
                +
              </button>
            </form>
            <div className="taskList">
              {planner.todayTasks.length === 0 && (
                <p className="emptyText">Inboxタスクはありません。</p>
              )}
              {planner.todayTasks.map((task) => (
                <article className={task.done ? "taskItem done" : "taskItem"} key={task.id}>
                  {(() => {
                    const editTarget = { kind: "today", id: task.id } as const;
                    const isEditing = isTaskBeingEdited(editTarget);
                    return (
                      <>
                        <button
                          className="checkButton"
                          type="button"
                          onClick={() => completeTodayTask(task.id)}
                          aria-label={`${task.title || "無題のタスク"}を完了`}
                        >
                          ✓
                        </button>
                          {isEditing ? (
                            <textarea
                              aria-label="Inboxタスク"
                              value={task.title}
                              onChange={(event) =>
                                updateTodayTaskTitle(task.id, event.target.value)
                              }
                              onKeyDown={handleTaskEditKeyDown}
                              onBlur={() => finishTaskEdit(editTarget)}
                              rows={1}
                            />
                          ) : (
                            <div
                              className="taskTitleView"
                              role="textbox"
                              aria-label="Inboxタスク"
                              aria-readonly="true"
                              tabIndex={0}
                              onDoubleClick={() => beginTaskEdit(editTarget)}
                            >
                              {task.title || " "}
                            </div>
                          )}
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
                      </>
                    );
                  })()}
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="homeColumn dailyColumn" aria-label="日次と週次">
          <section className="dailySectionCard" aria-label="毎日やることリスト">
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
            {planner.dailyTasks.map((task) => {
              const isCompleted = task.completedDates.includes(todayKey);
              const editTarget = { kind: "daily", id: task.id } as const;
              const isEditing = isTaskBeingEdited(editTarget);
              return (
                <article
                  className={isCompleted ? "taskItem done" : "taskItem"}
                  key={task.id}
                >
                  <button
                    className="checkButton"
                    type="button"
                    onClick={() => toggleDailyTask(task.id)}
                    aria-label={`${task.title || "無題のタスク"}の完了を切り替え`}
                  >
                    ✓
                  </button>
                  {isEditing ? (
                    <textarea
                      aria-label="毎日やること"
                      value={task.title}
                      onChange={(event) =>
                        updateDailyTaskTitle(task.id, event.target.value)
                      }
                      onKeyDown={handleTaskEditKeyDown}
                      onBlur={() => finishTaskEdit(editTarget)}
                      rows={1}
                    />
                  ) : (
                    <div
                      className="taskTitleView"
                      role="textbox"
                      aria-label="毎日やること"
                      aria-readonly="true"
                      tabIndex={0}
                      onDoubleClick={() => beginTaskEdit(editTarget)}
                    >
                      {task.title || " "}
                    </div>
                  )}
                  <button
                    className="iconButton"
                    type="button"
                    onClick={() => removeDailyTask(task.id)}
                    aria-label={`${task.title || "無題のタスク"}を削除`}
                  >
                    ×
                  </button>
                </article>
              );
            })}
          </div>
          </section>

          <section className="weeklySection" aria-label="毎週やることリスト">
            <div className="sectionHeader">
              <h3>毎週やることリスト</h3>
            </div>
            <form
              className="weeklyTaskForm"
              onSubmit={(event) => {
                event.preventDefault();
                addWeeklyTask();
              }}
            >
              <input
                aria-label="毎週やることを追加"
                placeholder="毎週やること"
                value={newWeeklyTaskTitle}
                onChange={(event) => setNewWeeklyTaskTitle(event.target.value)}
              />
              <button type="submit" aria-label="毎週やることを追加">
                +
              </button>
              <div className="weeklyTaskFormWeekdays">
                {renderWeekdayToggles(
                  selectedWeeklyWeekday,
                  toggleSelectedWeeklyWeekday,
                )}
              </div>
            </form>
            <div className="taskList">
              {planner.weeklyTasks.filter((task) => task.weekday === selectedWeeklyWeekday).length === 0 && (
                <p className="emptyText">毎週やることはありません。</p>
              )}
              {planner.weeklyTasks
                .filter((task) => task.weekday === selectedWeeklyWeekday)
                .map(renderWeeklyTask)}
            </div>
          </section>
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
