"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type GoalKey = "year" | "month" | "week";
type GoalMap = Record<GoalKey, string>;
type PeriodGoalMap = Record<GoalKey, Record<string, string>>;
type PeriodOffsets = Record<GoalKey, number>;
type HomeTab =
  | "today"
  | "recurring"
  | "inbox"
  | "diary";

type PriorityTask = {
  id: string;
  title: string;
  done: boolean;
  scheduledDate?: string;
  projectName?: string;
};

type DailyGroupKey = string;

type DailyPattern = "work" | "holiday";

type DailyTask = {
  id: string;
  title: string;
  time: string;
  weekday: number;
  pattern: DailyPattern;
  completedDates: string[];
};

type DailyTaskGroup = {
  key: DailyGroupKey;
  pattern: DailyPattern;
  title: string;
  startTime: string;
  endTime: string;
  theme: string;
  tasks: DailyTask[];
};

type TodayThemeTaskGroup = {
  key: DailyGroupKey;
  tasks: PriorityTask[];
};

type WeeklyTask = {
  id: string;
  title: string;
  weekday: number;
  completedWeeks: string[];
};

type MonthlyTask = {
  id: string;
  title: string;
  dayOfMonth: number;
  completedMonths: string[];
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
  todayTasks: PriorityTask[];
  todayThemeTaskGroups: TodayThemeTaskGroup[];
  inboxTasks: PriorityTask[];
  dailyTaskGroups: DailyTaskGroup[];
  dailyPatternByWeekday: Record<number, DailyPattern>;
  weeklyTasks: WeeklyTask[];
  monthlyTasks: MonthlyTask[];
};

type StoredPlannerState = Partial<PlannerState>;

type DiaryEntry = {
  id: string;
  date: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type TaskEditTarget =
  | { kind: "achievement"; id: string }
  | { kind: "today"; id: string }
  | { kind: "inbox"; id: string }
  | { kind: "weekly"; id: string }
  | { kind: "monthly"; id: string }
  | { kind: "daily"; id: string }
  | { kind: "daily-theme"; id: DailyGroupKey }
  | null;

type HomeClientProps = {
  initialPlannerValue: StoredPlannerState | null;
  initialDiaryValue: unknown;
};

const plannerStorageKey = "focus-planner-state-v1";
const diaryStorageKey = "diary-v1";
const achievementExpandedStorageKey = "focus-achievement-expanded-v1";
const homeTabStorageKey = "focus-home-tab-v1";
const dailyPatternStorageKey = "focus-daily-pattern-v1";
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

const defaultDailyPatternByWeekday: Record<number, DailyPattern> = {
  0: "holiday",
  1: "work",
  2: "work",
  3: "work",
  4: "work",
  5: "work",
  6: "holiday",
};

const dailyGroupDefinitions: Array<Pick<DailyTaskGroup, "key" | "title" | "startTime" | "endTime">> = [
  { key: "beforeBreakfast", title: "朝食前", startTime: "06:00", endTime: "09:00" },
  { key: "beforeLunch", title: "昼食前", startTime: "09:00", endTime: "12:00" },
  { key: "beforeDinner", title: "昼食後", startTime: "12:00", endTime: "19:00" },
  { key: "afterDinner", title: "夕食後", startTime: "19:00", endTime: "23:00" },
];

const dailyPatterns: DailyPattern[] = ["work", "holiday"];

function getDailyGroupPatternKey(pattern: DailyPattern, key: DailyGroupKey) {
  return `${pattern}-${key}`;
}

function createDefaultDailyTaskGroups() {
  return dailyPatterns.flatMap((pattern) =>
    dailyGroupDefinitions.map((definition) => ({
      key: getDailyGroupPatternKey(pattern, definition.key),
      pattern,
      title: definition.title,
      startTime: definition.startTime,
      endTime: definition.endTime,
      theme: "",
      tasks: [],
    })),
  );
}

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
  todayTasks: [],
  todayThemeTaskGroups: createDefaultDailyTaskGroups().map(({ key }) => ({
    key,
    tasks: [],
  })),
  inboxTasks: [],
  dailyTaskGroups: createDefaultDailyTaskGroups(),
  dailyPatternByWeekday: defaultDailyPatternByWeekday,
  weeklyTasks: [],
  monthlyTasks: [],
};

function getAchievementYearLabel(offset: number) {
  return `${currentYear + offset}年`;
}

function getWeekdayLabel(weekday: number) {
  return `${weekdayLabels[weekday]}曜日`;
}

function formatTimeLabel(time: string) {
  return time.replace(/^0(\d:)/, "$1");
}

function useCurrentTime() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(timerId);
  }, []);

  return currentTime;
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

function isValidTimeValue(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function createEmptyDailyTaskTitleMap() {
  return createDefaultDailyTaskGroups().reduce<Record<DailyGroupKey, string>>(
    (map, group) => ({
      ...map,
      [group.key]: "",
    }),
    {} as Record<DailyGroupKey, string>,
  );
}

function createEmptyTodayThemeTaskTitleMap() {
  return createDefaultDailyTaskGroups().reduce<Record<DailyGroupKey, string>>(
    (map, group) => ({
      ...map,
      [group.key]: "",
    }),
    {} as Record<DailyGroupKey, string>,
  );
}

function getDailyGroupKeyFromTime(time: unknown): DailyGroupKey {
  if (!isValidTimeValue(time)) return "beforeBreakfast";
  if (time < "11:00") return "beforeBreakfast";
  if (time < "15:00") return "beforeLunch";
  if (time < "20:00") return "beforeDinner";
  return "afterDinner";
}

function normalizeDailyTask(task: Partial<DailyTask>, index: number): DailyTask {
  return {
    id: task.id || `daily-task-${index + 1}`,
    title: task.title || "",
    time: isValidTimeValue(task.time) ? task.time : "09:00",
    weekday: typeof task.weekday === "number" && task.weekday >= 0 && task.weekday <= 6
      ? task.weekday
      : new Date().getDay(),
    pattern: task.pattern === "work" || task.pattern === "holiday"
      ? task.pattern
      : ((typeof task.weekday === "number" ? task.weekday : new Date().getDay()) === 0 || (typeof task.weekday === "number" ? task.weekday : new Date().getDay()) === 6 ? "holiday" : "work"),
    completedDates: Array.isArray(task.completedDates)
      ? task.completedDates.filter(
          (date): date is string => typeof date === "string",
        )
      : [],
  };
}

function normalizeDailyTaskGroups(
  value: StoredPlannerState & {
    dailyTaskGroups?: unknown;
    dailyTasks?: Array<Partial<DailyTask> & { time?: string }>;
  },
) {
  const fallbackGroups = Object.fromEntries(
    createDefaultDailyTaskGroups().map((group) => [group.key, group]),
  ) as Record<DailyGroupKey, DailyTaskGroup>;

  if (Array.isArray(value.dailyTaskGroups)) {
    value.dailyTaskGroups.forEach((group, groupIndex) => {
      const item = group as Partial<DailyTaskGroup>;
      if (!item.key) return;
      const pattern = item.pattern === "holiday" ? "holiday" : "work";
      const isLegacyGroup = item.pattern !== "work" && item.pattern !== "holiday";
      const key = isLegacyGroup ? getDailyGroupPatternKey(pattern, item.key) : item.key;
      const fallback = fallbackGroups[key] || {
        key,
        pattern,
        title: "新しいグループ",
        startTime: "09:00",
        endTime: "10:00",
        theme: "",
        tasks: [],
      };
      const tasks = Array.isArray(item.tasks)
        ? item.tasks.map((task, taskIndex) =>
            normalizeDailyTask(task, groupIndex * 100 + taskIndex),
          )
        : [];
      fallbackGroups[key] = {
        key,
        pattern,
        title: typeof item.title === "string" ? item.title : fallback.title,
        startTime: isValidTimeValue((item as { startTime?: unknown }).startTime)
          ? (item as { startTime: string }).startTime
          : isValidTimeValue((item as { time?: unknown }).time)
            ? (item as { time: string }).time
            : fallback.startTime,
        endTime: isValidTimeValue((item as { endTime?: unknown }).endTime)
          ? (item as { endTime: string }).endTime
          : fallback.endTime,
        theme: typeof item.theme === "string" ? item.theme : "",
        tasks,
      };

      if (isLegacyGroup) {
        const holidayTasks = tasks.filter((task) => task.pattern === "holiday");
        if (holidayTasks.length > 0) {
          const holidayKey = getDailyGroupPatternKey("holiday", item.key);
          fallbackGroups[holidayKey] = {
            ...fallbackGroups[holidayKey],
            key: holidayKey,
            pattern: "holiday",
            title: typeof item.title === "string" ? item.title : fallback.title,
            startTime: fallbackGroups[key].startTime,
            endTime: fallbackGroups[key].endTime,
            theme: typeof item.theme === "string" ? item.theme : "",
            tasks: holidayTasks,
          };
        }
      }
    });

    return Object.values(fallbackGroups);
  }

  if (Array.isArray(value.dailyTasks)) {
    value.dailyTasks.forEach((task, index) => {
      const normalizedTask = normalizeDailyTask(task, index);
      const groupKey = getDailyGroupPatternKey(
        normalizedTask.pattern,
        getDailyGroupKeyFromTime(task.time),
      );
      fallbackGroups[groupKey].tasks.push(normalizedTask);
    });
  }

  return Object.values(fallbackGroups);
}

function normalizeTodayThemeTaskGroups(
  value: StoredPlannerState & {
    todayThemeTaskGroups?: unknown;
    todayTasks?: PriorityTask[];
    priorities?: PriorityTask[];
  },
) {
  const fallbackGroups = Object.fromEntries(
    createDefaultDailyTaskGroups().map((group) => [group.key, { key: group.key, tasks: [] }]),
  ) as Record<DailyGroupKey, TodayThemeTaskGroup>;

  if (Array.isArray(value.todayThemeTaskGroups)) {
    value.todayThemeTaskGroups.forEach((group, groupIndex) => {
      const item = group as Partial<TodayThemeTaskGroup>;
      if (!item.key) return;
      const key = item.key.startsWith("work-") || item.key.startsWith("holiday-")
        ? item.key
        : getDailyGroupPatternKey("work", item.key);
      if (!fallbackGroups[key]) {
        fallbackGroups[key] = { key, tasks: [] };
      }
      fallbackGroups[key] = {
        key,
        tasks: Array.isArray(item.tasks)
          ? item.tasks
              .filter((task): task is PriorityTask => Boolean(task))
              .map((task, taskIndex) => ({
                id: task.id || `today-theme-task-${groupIndex + 1}-${taskIndex + 1}`,
                title: task.title || "",
                done: false,
                projectName: task.projectName || undefined,
              }))
          : [],
      };
    });

    return Object.values(fallbackGroups);
  }

  const legacyTodayTasks = Array.isArray(value.todayTasks)
    ? value.todayTasks
    : Array.isArray(value.priorities)
      ? value.priorities
      : [];

  fallbackGroups[getDailyGroupPatternKey("work", "beforeBreakfast")].tasks = legacyTodayTasks
    .filter((task) => !task.done)
    .map((task, index) => ({
      id: task.id || `today-theme-task-${index + 1}`,
      title: task.title || "",
      done: false,
      projectName: task.projectName || undefined,
    }));

  return Object.values(fallbackGroups);
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

function getRemainingDaysInMonth(date: Date, fromFirstDay = false) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - (fromFirstDay ? 1 : date.getDate()));
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

function getCurrentMonthKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthlySlotKey(monthKey: string, dayOfMonth: number) {
  return `${monthKey}-${dayOfMonth}`;
}

function getPeriodInfo(offsets: PeriodOffsets) {
  const today = new Date();
  const yearDate = new Date(today);
  yearDate.setFullYear(today.getFullYear() + offsets.year);

  const monthDate = new Date(today);
  monthDate.setMonth(today.getMonth() + offsets.month);

  const nextYearDate = new Date(yearDate.getFullYear() + 1, 0, 1);
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
      month: getRemainingDaysInMonth(monthDate, offsets.month !== 0),
      week: offsets.week === 0 ? getRemainingDaysInPeriod(nextWeekDate) : 7,
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

function prunePlannerCompletionState(
  planner: PlannerState,
  nextTodayKey: string,
  nextWeekKey: string,
  nextMonthKey: string,
) {
  let hasChanges = false;

  const nextDailyTaskGroups = planner.dailyTaskGroups.map((group) => {
    let groupChanged = false;
    const nextTasks = group.tasks.map((task) => {
      const nextCompletedDates = task.completedDates.filter(
        (date) => date === nextTodayKey,
      );
      if (nextCompletedDates.length !== task.completedDates.length) {
        groupChanged = true;
      }
      return nextCompletedDates.length === task.completedDates.length
        ? task
        : { ...task, completedDates: nextCompletedDates };
    });

    if (!groupChanged) return group;
    hasChanges = true;
    return { ...group, tasks: nextTasks };
  });

  const nextWeeklyTasks = planner.weeklyTasks.map((task) => {
    const nextCompletedWeeks = task.completedWeeks.filter((slot) =>
      slot.startsWith(`${nextWeekKey}-`),
    );
    if (nextCompletedWeeks.length === task.completedWeeks.length) {
      return task;
    }
    hasChanges = true;
    return { ...task, completedWeeks: nextCompletedWeeks };
  });

  const nextMonthlyTasks = planner.monthlyTasks.map((task) => {
    const nextCompletedMonths = task.completedMonths.filter((slot) =>
      slot.startsWith(`${nextMonthKey}-`),
    );
    if (nextCompletedMonths.length === task.completedMonths.length) {
      return task;
    }
    hasChanges = true;
    return { ...task, completedMonths: nextCompletedMonths };
  });

  if (!hasChanges) return planner;

  return {
    ...planner,
    dailyTaskGroups: nextDailyTaskGroups,
    weeklyTasks: nextWeeklyTasks,
    monthlyTasks: nextMonthlyTasks,
  };
}

function normalizePlanner(value: StoredPlannerState): PlannerState {
  const legacyValue = value as StoredPlannerState & {
    priorities?: PriorityTask[];
    achievementTasks?: AchievementTask[];
    dailyTasks?: DailyTask[];
    dailyTaskGroups?: DailyTaskGroup[];
    dailyPatternByWeekday?: Partial<Record<number, DailyPattern>>;
    weeklyTasks?: WeeklyTask[];
    monthlyTasks?: MonthlyTask[];
    inboxTasks?: PriorityTask[];
  };
  const rawAchievementTasks = Array.isArray(legacyValue.achievementTasks)
    ? legacyValue.achievementTasks
    : initialState.achievementTasks;
  const rawTodayTasks = Array.isArray(value.todayTasks)
    ? value.todayTasks
    : Array.isArray(legacyValue.priorities)
      ? legacyValue.priorities
      : initialState.todayTasks;
  const rawInboxTasks = Array.isArray(legacyValue.inboxTasks)
    ? legacyValue.inboxTasks
    : initialState.inboxTasks;
  const rawWeeklyTasks = Array.isArray(legacyValue.weeklyTasks)
    ? legacyValue.weeklyTasks
    : initialState.weeklyTasks;
  const rawMonthlyTasks = Array.isArray(legacyValue.monthlyTasks)
    ? legacyValue.monthlyTasks
    : initialState.monthlyTasks;
  const fallbackWeekday = new Date().getDay();
  const fallbackMonthDay = new Date().getDate();
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
    todayTasks: rawTodayTasks
      .filter((task) => !task.done)
      .map((task, index) => ({
        id: task.id || `today-task-${index + 1}`,
        title: task.title || "",
        done: false,
        projectName: task.projectName || undefined,
      })),
    todayThemeTaskGroups: normalizeTodayThemeTaskGroups(legacyValue),
    inboxTasks: rawInboxTasks
      .filter((task) => !task.done)
      .map((task, index) => ({
        id: task.id || `inbox-task-${index + 1}`,
        title: task.title || "",
        done: false,
        scheduledDate: typeof task.scheduledDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate)
          ? task.scheduledDate
          : undefined,
        projectName: task.projectName || undefined,
      })),
    dailyTaskGroups: normalizeDailyTaskGroups(legacyValue),
    dailyPatternByWeekday: weekdayOrder.reduce<Record<number, DailyPattern>>(
      (patterns, weekday) => ({
        ...patterns,
        [weekday]: legacyValue.dailyPatternByWeekday?.[weekday] === "holiday"
          ? "holiday"
          : legacyValue.dailyPatternByWeekday?.[weekday] === "work"
            ? "work"
            : defaultDailyPatternByWeekday[weekday],
      }),
      {} as Record<number, DailyPattern>,
    ),
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
    monthlyTasks: rawMonthlyTasks.map((task, index) => {
      const legacyTask = task as {
        dayOfMonth?: unknown;
        day?: unknown;
        completedMonths?: unknown[];
        completedSlots?: unknown[];
      };
      const dayOfMonth =
        typeof legacyTask.dayOfMonth === "number" &&
        Number.isInteger(legacyTask.dayOfMonth) &&
        legacyTask.dayOfMonth >= 1 &&
        legacyTask.dayOfMonth <= 31
          ? legacyTask.dayOfMonth
          : typeof legacyTask.day === "number" &&
              Number.isInteger(legacyTask.day) &&
              legacyTask.day >= 1 &&
              legacyTask.day <= 31
            ? legacyTask.day
            : fallbackMonthDay;
      const completedMonths = Array.isArray(legacyTask.completedMonths)
        ? legacyTask.completedMonths.filter(
            (slot): slot is string => typeof slot === "string",
          )
        : Array.isArray(legacyTask.completedSlots)
          ? legacyTask.completedSlots.filter(
              (slot): slot is string => typeof slot === "string",
            )
          : [];
      return {
        id: task.id || `monthly-task-${index + 1}`,
        title: task.title || "",
        dayOfMonth,
        completedMonths,
      };
    }),
  };
}

export default function HomeClient({
  initialPlannerValue,
  initialDiaryValue,
}: HomeClientProps) {
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
  const [newInboxTaskTitle, setNewInboxTaskTitle] = useState("");
  const [newDailyTaskTitles, setNewDailyTaskTitles] = useState(() =>
    createEmptyDailyTaskTitleMap(),
  );
  const [newDailyTaskTimes, setNewDailyTaskTimes] = useState<Record<DailyGroupKey, string>>({});
  const [newDailyGroupTitle, setNewDailyGroupTitle] = useState("");
  const [newDailyGroupStartTime, setNewDailyGroupStartTime] = useState("09:00");
  const [newDailyGroupEndTime, setNewDailyGroupEndTime] = useState("10:00");
  const [newDailyGroupTheme, setNewDailyGroupTheme] = useState("");
  const [isDailyGroupModalOpen, setIsDailyGroupModalOpen] = useState(false);
  const [newTodayThemeTaskTitles, setNewTodayThemeTaskTitles] = useState(() =>
    createEmptyTodayThemeTaskTitleMap(),
  );
  const [newWeeklyTaskTitle, setNewWeeklyTaskTitle] = useState("");
  const [selectedWeeklyWeekday, setSelectedWeeklyWeekday] = useState(
    () => new Date().getDay(),
  );
  const [selectedDailyPattern, setSelectedDailyPattern] = useState<DailyPattern>("work");
  const [newMonthlyTaskTitle, setNewMonthlyTaskTitle] = useState("");
  const [selectedMonthlyDay, setSelectedMonthlyDay] = useState(
    () => new Date().getDate(),
  );
  const [selectedHomeTab, setSelectedHomeTab] =
    useState<HomeTab>("today");
  const [periodOffsets, setPeriodOffsets] = useState<PeriodOffsets>({
    year: 0,
    month: 0,
    week: 0,
  });
  const periodInfo = getPeriodInfo(periodOffsets);
  const periodLabels = periodInfo.labels;
  const periodKeys = periodInfo.keys;
  const remainingDays = periodInfo.remainingDays;
  const currentWeekKey = getCurrentWeekKey();
  const achievementYear = currentYear + achievementYearOffset;
  const currentWeeklySlotKey = getWeeklySlotKey(currentWeekKey, selectedWeeklyWeekday);
  const currentMonthKey = getCurrentMonthKey();
  const currentMonthlySlotKey = getMonthlySlotKey(currentMonthKey, selectedMonthlyDay);
  const dailyTaskGroupsByTime = useMemo(
    () => [...planner.dailyTaskGroups].sort((first, second) => first.startTime.localeCompare(second.startTime)),
    [planner.dailyTaskGroups],
  );
  const currentTime = useCurrentTime();
  const todayDailyPattern = planner.dailyPatternByWeekday[currentTime.getDay()];
  const currentTimeValue = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
  const availableDailyTasks = dailyTaskGroupsByTime
    .filter((group) => group.pattern === todayDailyPattern)
    .flatMap((group) => group.tasks.map((task) => ({ group, task })))
    .filter(({ task }) => task.pattern === todayDailyPattern && !task.completedDates.includes(todayKey))
    .sort((first, second) => first.task.time.localeCompare(second.task.time));
  const currentOrPreviousDailyTasks = availableDailyTasks.filter(
    ({ task }) => task.time <= currentTimeValue,
  );
  const currentDailyTaskEntry = currentOrPreviousDailyTasks.at(-1) || availableDailyTasks[0];
  const weekStart = getWeekStartDate();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartKey = formatDateKey(weekStart);
  const weekEndKey = formatDateKey(weekEnd);
  const scheduledInboxTasks = planner.inboxTasks.filter((task) => task.scheduledDate);
  const todayInboxTasks = scheduledInboxTasks.filter((task) => task.scheduledDate === todayKey);
  const weekInboxTasks = scheduledInboxTasks.filter(
    (task) => task.scheduledDate! > todayKey && task.scheduledDate! >= weekStartKey && task.scheduledDate! <= weekEndKey,
  );
  const monthInboxTasks = scheduledInboxTasks.filter(
    (task) => task.scheduledDate! > todayKey && task.scheduledDate?.startsWith(todayKey.slice(0, 7)) && (task.scheduledDate! < weekStartKey || task.scheduledDate! > weekEndKey),
  );
  const currentWeekday = currentTime.getDay();
  const currentWeekdayIndex = (currentWeekday + 6) % 7;
  const currentDayOfMonth = currentTime.getDate();
  const overdueWeeklyTasks = planner.weeklyTasks.filter(
    (task) =>
      (task.weekday + 6) % 7 < currentWeekdayIndex &&
      !task.completedWeeks.includes(getWeeklySlotKey(currentWeekKey, task.weekday)),
  );
  const overdueMonthlyTasks = planner.monthlyTasks.filter(
    (task) =>
      task.dayOfMonth < currentDayOfMonth &&
      !task.completedMonths.includes(getMonthlySlotKey(currentMonthKey, task.dayOfMonth)),
  );
  const overdueInboxTasks = scheduledInboxTasks.filter(
    (task) => task.scheduledDate! < todayKey,
  );
  const hasOverdueTasks = overdueWeeklyTasks.length + overdueMonthlyTasks.length + overdueInboxTasks.length > 0;
  const homeTabs: Array<{ key: HomeTab; label: string }> = [
    { key: "today", label: "今日" },
    { key: "inbox", label: "Inbox" },
    { key: "recurring", label: "繰り返し" },
    { key: "diary", label: "日記" },
  ];
  const showTodayTab = selectedHomeTab === "today";
  const showInboxTab = selectedHomeTab === "inbox";
  const showRecurringTab = selectedHomeTab === "recurring";
  const showDiaryTab = selectedHomeTab === "diary";

  useEffect(() => {
    try {
      const storedTab = window.localStorage.getItem(homeTabStorageKey);
      if (
        storedTab === "today" ||
        storedTab === "recurring" ||
        storedTab === "inbox" ||
        storedTab === "diary"
      ) {
        setSelectedHomeTab(storedTab);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(homeTabStorageKey, selectedHomeTab);
    } catch {
      return;
    }
  }, [selectedHomeTab]);

  useEffect(() => {
    try {
      const storedPattern = window.localStorage.getItem(dailyPatternStorageKey);
      if (storedPattern === "work" || storedPattern === "holiday") setSelectedDailyPattern(storedPattern);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(dailyPatternStorageKey, selectedDailyPattern);
    } catch {
      return;
    }
  }, [selectedDailyPattern]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const scheduleNextTick = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);

      timeoutId = window.setTimeout(() => {
        setTodayKey(formatDateKey(new Date()));
        setTodayLabel(getTodayLabel());
        setSelectedMonthlyDay(new Date().getDate());
        scheduleNextTick();
      }, Math.max(0, nextMidnight.getTime() - now.getTime()));
    };

    scheduleNextTick();
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    setPlanner((current) =>
      prunePlannerCompletionState(
        current,
        todayKey,
        currentWeekKey,
        currentMonthKey,
      ),
    );
  }, [currentMonthKey, currentWeekKey, todayKey]);

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
        ".taskList textarea",
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
    event: {
      key: string;
      preventDefault: () => void;
      currentTarget: { blur: () => void };
      nativeEvent?: { isComposing?: boolean };
      isComposing?: boolean;
    },
  ) {
    if (event.isComposing || event.nativeEvent?.isComposing) {
      return;
    }

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

  function addInboxTask() {
    const title = newInboxTaskTitle.trim();
    if (!title) return;
    setPlanner((current) => ({
      ...current,
      inboxTasks: [
        ...current.inboxTasks,
        { id: createId("inbox-task"), title, done: false },
      ],
    }));
    setNewInboxTaskTitle("");
  }

  function updateInboxTaskTitle(id: string, title: string) {
    setPlanner((current) => ({
      ...current,
      inboxTasks: current.inboxTasks.map((task) =>
        task.id === id ? { ...task, title } : task,
      ),
    }));
  }

  function updateInboxTaskScheduledDate(id: string, scheduledDate: string) {
    setPlanner((current) => ({
      ...current,
      inboxTasks: current.inboxTasks.map((task) =>
        task.id === id ? { ...task, scheduledDate: scheduledDate || undefined } : task,
      ),
    }));
  }

  function completeInboxTask(id: string) {
    setPlanner((current) => ({
      ...current,
      inboxTasks: current.inboxTasks.filter((task) => task.id !== id),
    }));
  }

  function updateNewDailyTaskTitle(groupKey: DailyGroupKey, title: string) {
    setNewDailyTaskTitles((current) => ({
      ...current,
      [groupKey]: title,
    }));
  }

  function updateNewTodayThemeTaskTitle(groupKey: DailyGroupKey, title: string) {
    setNewTodayThemeTaskTitles((current) => ({
      ...current,
      [groupKey]: title,
    }));
  }

  function addTodayThemeTask(groupKey: DailyGroupKey) {
    const title = (newTodayThemeTaskTitles[groupKey] || "").trim();
    if (!title) return;
    setPlanner((current) => ({
      ...current,
      todayThemeTaskGroups: current.todayThemeTaskGroups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              tasks: [
                ...group.tasks,
                {
                  id: createId("today-theme-task"),
                  title,
                  done: false,
                },
              ],
            }
          : group,
      ),
    }));
    updateNewTodayThemeTaskTitle(groupKey, "");
  }

  function updateTodayThemeTaskTitle(groupKey: DailyGroupKey, id: string, title: string) {
    setPlanner((current) => ({
      ...current,
      todayThemeTaskGroups: current.todayThemeTaskGroups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              tasks: group.tasks.map((task) =>
                task.id === id ? { ...task, title } : task,
              ),
            }
          : group,
      ),
    }));
  }

  function completeTodayThemeTask(groupKey: DailyGroupKey, id: string) {
    setPlanner((current) => ({
      ...current,
      todayThemeTaskGroups: current.todayThemeTaskGroups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              tasks: group.tasks.filter((task) => task.id !== id),
            }
          : group,
      ),
    }));
  }

  function removeTodayThemeTask(groupKey: DailyGroupKey, id: string) {
    completeTodayThemeTask(groupKey, id);
  }

  function addDailyTask(groupKey: DailyGroupKey) {
    const title = (newDailyTaskTitles[groupKey] || "").trim();
    const time = newDailyTaskTimes[groupKey] || "09:00";
    if (!title || !isValidTimeValue(time)) return;
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: current.dailyTaskGroups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              tasks: [
                ...group.tasks,
                {
                  id: createId("daily-task"),
                  title,
                  time,
                  weekday: new Date().getDay(),
                  pattern: group.pattern,
                  completedDates: [],
                },
              ],
            }
          : group,
      ),
    }));
    updateNewDailyTaskTitle(groupKey, "");
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

  function addMonthlyTask() {
    const title = newMonthlyTaskTitle.trim();
    if (!title) return;
    setPlanner((current) => ({
      ...current,
      monthlyTasks: [
        ...current.monthlyTasks,
        {
          id: createId("monthly-task"),
          title,
          dayOfMonth: selectedMonthlyDay,
          completedMonths: [],
        },
      ],
    }));
    setNewMonthlyTaskTitle("");
  }

  function updateDailyTaskGroupTheme(groupKey: DailyGroupKey, theme: string) {
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: current.dailyTaskGroups.map((group) =>
        group.key === groupKey ? { ...group, theme } : group,
      ),
    }));
  }

  function updateDailyTaskGroup(groupKey: DailyGroupKey, value: Partial<Pick<DailyTaskGroup, "title" | "startTime" | "endTime" | "theme">>) {
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: current.dailyTaskGroups.map((group) =>
        group.key === groupKey ? { ...group, ...value } : group,
      ),
    }));
  }

  function addDailyTaskGroup() {
    const title = newDailyGroupTitle.trim();
    if (!title || !isValidTimeValue(newDailyGroupStartTime) || !isValidTimeValue(newDailyGroupEndTime)) return;
    const key = getDailyGroupPatternKey(selectedDailyPattern, createId("daily-group"));
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: [...current.dailyTaskGroups, { key, pattern: selectedDailyPattern, title, startTime: newDailyGroupStartTime, endTime: newDailyGroupEndTime, theme: newDailyGroupTheme, tasks: [] }],
      todayThemeTaskGroups: [...current.todayThemeTaskGroups, { key, tasks: [] }],
    }));
    setNewDailyTaskTitles((current) => ({ ...current, [key]: "" }));
    setNewDailyGroupTitle("");
    setNewDailyGroupTheme("");
    setIsDailyGroupModalOpen(false);
  }

  function removeDailyTaskGroup(groupKey: DailyGroupKey) {
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: current.dailyTaskGroups.filter((group) => group.key !== groupKey),
      todayThemeTaskGroups: current.todayThemeTaskGroups.filter((group) => group.key !== groupKey),
    }));
  }

  function setDailyPatternForWeekday(weekday: number) {
    setPlanner((current) => ({
      ...current,
      dailyPatternByWeekday: {
        ...current.dailyPatternByWeekday,
        [weekday]: selectedDailyPattern,
      },
    }));
  }

  function updateDailyTaskTitle(groupKey: DailyGroupKey, id: string, title: string) {
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: current.dailyTaskGroups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              tasks: group.tasks.map((task) =>
                task.id === id ? { ...task, title } : task,
              ),
            }
          : group,
      ),
    }));
  }

  function updateDailyTaskTime(groupKey: DailyGroupKey, id: string, time: string) {
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: current.dailyTaskGroups.map((group) =>
        group.key === groupKey
          ? { ...group, tasks: group.tasks.map((task) => task.id === id ? { ...task, time } : task) }
          : group,
      ),
    }));
  }

  function toggleDailyTask(groupKey: DailyGroupKey, id: string) {
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: current.dailyTaskGroups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              tasks: group.tasks.map((task) => {
                if (task.id !== id) return task;
                const isCompleted = task.completedDates.includes(todayKey);
                return {
                  ...task,
                  completedDates: isCompleted
                    ? task.completedDates.filter((date) => date !== todayKey)
                    : [...task.completedDates, todayKey],
                };
              }),
            }
          : group,
      ),
    }));
  }

  function removeDailyTask(groupKey: DailyGroupKey, id: string) {
    setPlanner((current) => ({
      ...current,
      dailyTaskGroups: current.dailyTaskGroups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              tasks: group.tasks.filter((task) => task.id !== id),
            }
          : group,
      ),
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

  function updateMonthlyTaskTitle(id: string, title: string) {
    setPlanner((current) => ({
      ...current,
      monthlyTasks: current.monthlyTasks.map((task) =>
        task.id === id ? { ...task, title } : task,
      ),
    }));
  }

  function toggleSelectedMonthlyDay(dayOfMonth: number) {
    setSelectedMonthlyDay(dayOfMonth);
  }

  function toggleMonthlyTask(id: string) {
    setPlanner((current) => ({
      ...current,
      monthlyTasks: current.monthlyTasks.map((task) => {
        if (task.id !== id) return task;
        if (task.dayOfMonth !== selectedMonthlyDay) return task;
        const isCompleted = task.completedMonths.includes(currentMonthlySlotKey);
        return {
          ...task,
          completedMonths: isCompleted
            ? task.completedMonths.filter((slot) => slot !== currentMonthlySlotKey)
            : [...task.completedMonths, currentMonthlySlotKey],
        };
      }),
    }));
  }

  function removeMonthlyTask(id: string) {
    setPlanner((current) => ({
      ...current,
      monthlyTasks: current.monthlyTasks.filter((task) => task.id !== id),
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

  function renderDailyPatternWeekdayToggles() {
    return (
      <div className="weekdayToggleRow" aria-label={`${selectedDailyPattern === "work" ? "仕事" : "休日"}を適用する曜日`}>
        {weekdayOrder.map((weekday) => {
          const isActive = planner.dailyPatternByWeekday[weekday] === selectedDailyPattern;
          return (
            <button
              key={weekday}
              className={isActive ? "weekdayToggle active" : "weekdayToggle"}
              type="button"
              onClick={() =>
                setPlanner((current) => ({
                  ...current,
                  dailyPatternByWeekday: {
                    ...current.dailyPatternByWeekday,
                    [weekday]: current.dailyPatternByWeekday[weekday] === "work" ? "holiday" : "work",
                  },
                }))
              }
              aria-pressed={isActive}
              aria-label={`${getWeekdayLabel(weekday)}を${isActive ? "休日" : "仕事"}に切り替える`}
            >
              {weekdayLabels[weekday]}
            </button>
          );
        })}
      </div>
    );
  }

  function renderMonthdayToggles(
    selectedDay: number,
    onToggle: (dayOfMonth: number) => void,
  ) {
    const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
    return (
      <div className="monthdayToggleRow">
        {monthDays.map((day) => {
          const isActive = selectedDay === day;
          return (
            <button
              key={day}
              className={isActive ? "monthdayToggle active" : "monthdayToggle"}
              type="button"
              onClick={() => onToggle(day)}
              aria-pressed={isActive}
              aria-label={`${day}日`}
            >
              {day}
            </button>
          );
        })}
      </div>
    );
  }

  function renderDailyTaskGroup(group: DailyTaskGroup, pattern: DailyPattern) {
    const groupLabel = group.title || "無題のグループ";
    const tasks = group.tasks
      .filter((task) => task.pattern === pattern)
      .sort((first, second) => first.time.localeCompare(second.time));

    return (
      <section className="dailyGroupCard" key={group.key} aria-label={`${groupLabel}の毎日タスク`}>
        <div className="sectionHeader dailyGroupHeader">
          <input className="dailyGroupTitleInput" aria-label="グループ名" value={group.title} onChange={(event) => updateDailyTaskGroup(group.key, { title: event.currentTarget.value })} />
          <button className="iconButton dailyGroupDeleteButton" type="button" onClick={() => removeDailyTaskGroup(group.key)} aria-label={`${groupLabel}を削除`}>×</button>
        </div>
        <div className="dailyGroupMetaFields"><div className="dailyGroupNameTimeFields"><input type="time" aria-label={`${groupLabel}の開始時刻`} value={group.startTime} onChange={(event) => updateDailyTaskGroup(group.key, { startTime: event.currentTarget.value })} /><span>〜</span><input type="time" aria-label={`${groupLabel}の終了時刻`} value={group.endTime} onChange={(event) => updateDailyTaskGroup(group.key, { endTime: event.currentTarget.value })} /></div><input aria-label={`${groupLabel}のテーマ`} placeholder="テーマ" value={group.theme} onChange={(event) => updateDailyTaskGroup(group.key, { theme: event.currentTarget.value })} /></div>
        <form
          className="taskForm dailyTaskForm"
          onSubmit={(event) => {
            event.preventDefault();
            addDailyTask(group.key);
          }}
        >
          <input className="dailyTaskTimeInput" aria-label={`${groupLabel}のタスク時刻`} type="time" value={newDailyTaskTimes[group.key] || "09:00"} onChange={(event) => { const time = event.currentTarget.value; setNewDailyTaskTimes((current) => ({ ...current, [group.key]: time })); }} />
          <input
            aria-label={`${groupLabel}の毎日タスクを追加`}
            value={newDailyTaskTitles[group.key] || ""}
            onChange={(event) => updateNewDailyTaskTitle(group.key, event.target.value)}
          />
          <button
            className="recurringAddButton"
            type="submit"
            aria-label={`${groupLabel}の毎日タスクを追加`}
          >
            +
          </button>
        </form>
        <div className="taskList">
          {tasks.length === 0 && (
            <p className="emptyText">タスクはありません。</p>
          )}
          {tasks.map((task) => {
            const editTarget = { kind: "daily", id: task.id } as const;
            const isEditing = isTaskBeingEdited(editTarget);
            return (
              <article
                className="taskItem dailyItem noCompletion"
                key={task.id}
              >
                <input className="dailyTaskTimeInput" aria-label={`${task.title || "タスク"}の時刻`} type="time" value={task.time} onChange={(event) => updateDailyTaskTime(group.key, task.id, event.currentTarget.value)} />
                {isEditing ? (
                  <textarea
                    aria-label="毎日のタスク"
                    value={task.title}
                    onChange={(event) =>
                      updateDailyTaskTitle(group.key, task.id, event.target.value)
                    }
                    onKeyDown={handleTaskEditKeyDown}
                    onBlur={() => finishTaskEdit(editTarget)}
                    rows={1}
                  />
                ) : (
                  <div
                    className="taskTitleView"
                    role="textbox"
                    aria-label="毎日のタスク"
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
                  onClick={() => removeDailyTask(group.key, task.id)}
                  aria-label={`${task.title || "無題のタスク"}を削除`}
                >
                  ×
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderTodayDailyGroup(group: DailyTaskGroup) {
    const groupLabel = group.title || "無題のグループ";
    const todayThemeGroup =
      planner.todayThemeTaskGroups.find((item) => item.key === group.key) || null;
    const todayPattern = planner.dailyPatternByWeekday[new Date().getDay()];
    const tasks = group.tasks
      .filter((task) => task.pattern === todayPattern)
      .sort((first, second) => first.time.localeCompare(second.time));

    return (
      <section
        className={`dailyGroupCard ${`dailyGroupTone-${group.key}`}`}
        key={group.key}
        aria-label={`${groupLabel}の今日のタスク`}
      >
        <div className="sectionHeader dailyGroupHeader">
          <h3>{groupLabel} <span className="dailyGroupTime">{formatTimeLabel(group.startTime)}〜{formatTimeLabel(group.endTime)}</span></h3>
          <span className="sectionMeta">{group.theme || "テーマ未設定"}</span>
        </div>
        <div className="taskList">
          {(!todayThemeGroup || todayThemeGroup.tasks.length === 0) && tasks.length === 0 && (
            <p className="emptyText">タスクはありません。</p>
          )}
          {todayThemeGroup?.tasks.map((task) => {
            const editTarget = { kind: "today", id: task.id } as const;
            const isEditing = isTaskBeingEdited(editTarget);
            return (
              <article className="taskItem dailyItem dailyOneoffItem" key={task.id}>
                <button
                  className="checkButton"
                  type="button"
                  onClick={() => completeTodayThemeTask(group.key, task.id)}
                  aria-label={`${task.title || "無題のタスク"}を完了`}
                >
                  ✓
                </button>
                {isEditing ? (
                  <textarea
                    aria-label="今日の通常タスク"
                    value={task.title}
                    onChange={(event) =>
                      updateTodayThemeTaskTitle(group.key, task.id, event.target.value)
                    }
                    onKeyDown={handleTaskEditKeyDown}
                    onBlur={() => finishTaskEdit(editTarget)}
                    rows={1}
                  />
                ) : (
                  <div
                    className="taskTitleView"
                    role="textbox"
                    aria-label="今日の通常タスク"
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
                  onClick={() => removeTodayThemeTask(group.key, task.id)}
                  aria-label={`${task.title || "無題のタスク"}を削除`}
                >
                  ×
                </button>
              </article>
            );
          })}
          {tasks.map((task) => {
            const isCompleted = task.completedDates.includes(todayKey);
            const editTarget = { kind: "daily", id: task.id } as const;
            const isEditing = isTaskBeingEdited(editTarget);
            return (
              <article
                className={isCompleted ? "taskItem done dailyItem" : "taskItem dailyItem"}
                key={task.id}
              >
                <button
                  className="checkButton"
                  type="button"
                  onClick={() => toggleDailyTask(group.key, task.id)}
                  aria-label={`${task.title || "無題のタスク"}の完了を切り替え`}
                >
                  ✓
                </button>
                {isEditing ? (
                  <textarea
                    aria-label="毎日のタスク"
                    value={task.title}
                    onChange={(event) =>
                      updateDailyTaskTitle(group.key, task.id, event.target.value)
                    }
                    onKeyDown={handleTaskEditKeyDown}
                    onBlur={() => finishTaskEdit(editTarget)}
                    rows={1}
                  />
                ) : (
                  <div
                    className="taskTitleView recurringTaskTitleView"
                    role="textbox"
                    aria-label="毎日のタスク"
                    aria-readonly="true"
                    tabIndex={0}
                    onDoubleClick={() => beginTaskEdit(editTarget)}
                  >
                    <span className="recurringInlineBadge" aria-hidden="true">
                      ↻ 繰り返し
                    </span>
                    <span className="dailyTaskTimeBadge">{formatTimeLabel(task.time)}</span>
                    <span>{task.title || " "}</span>
                  </div>
                )}
                <button
                  className="iconButton"
                  type="button"
                  onClick={() => removeDailyTask(group.key, task.id)}
                  aria-label={`${task.title || "無題のタスク"}を削除`}
                >
                  ×
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderWeeklyTask(
    task: WeeklyTask,
    activeWeekday = selectedWeeklyWeekday,
    showCompletion = true,
  ) {
    const editTarget = { kind: "weekly", id: task.id } as const;
    const isEditing = isTaskBeingEdited(editTarget);
    const activeWeeklySlotKey = getWeeklySlotKey(currentWeekKey, activeWeekday);
    const isTodayScheduled = task.weekday === activeWeekday;
    const isCompleted = task.completedWeeks.includes(activeWeeklySlotKey);
    return (
      <article
        className={isCompleted ? `taskItem done weeklyItem${showCompletion ? "" : " noCompletion"}` : `taskItem weeklyItem${showCompletion ? "" : " noCompletion"}`}
        key={task.id}
      >
        {showCompletion && <button
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
        </button>}
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

  function renderMonthlyTask(
    task: MonthlyTask,
    activeDayOfMonth = selectedMonthlyDay,
    showCompletion = true,
  ) {
    const editTarget = { kind: "monthly", id: task.id } as const;
    const isEditing = isTaskBeingEdited(editTarget);
    const activeMonthlySlotKey = getMonthlySlotKey(currentMonthKey, activeDayOfMonth);
    const isTodayScheduled = task.dayOfMonth === activeDayOfMonth;
    const isCompleted = task.completedMonths.includes(activeMonthlySlotKey);
    return (
      <article
        className={isCompleted ? `taskItem done monthlyItem${showCompletion ? "" : " noCompletion"}` : `taskItem monthlyItem${showCompletion ? "" : " noCompletion"}`}
        key={task.id}
      >
        {showCompletion && <button
          className="checkButton"
          type="button"
          onClick={() => toggleMonthlyTask(task.id)}
          disabled={!isTodayScheduled}
          aria-label={
            isTodayScheduled
              ? `${task.title || "無題のタスク"}を今月分完了`
              : `${task.title || "無題のタスク"}は選択中の日付の対象外`
          }
        >
          ✓
        </button>}
        {isEditing ? (
          <textarea
            aria-label="毎月やること"
            value={task.title}
            onChange={(event) =>
              updateMonthlyTaskTitle(task.id, event.target.value)
            }
            onKeyDown={handleTaskEditKeyDown}
            onBlur={() => finishTaskEdit(editTarget)}
            rows={1}
          />
        ) : (
          <div
            className="taskTitleView"
            role="textbox"
            aria-label="毎月やること"
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
          onClick={() => removeMonthlyTask(task.id)}
          aria-label={`${task.title || "無題のタスク"}を削除`}
        >
          ×
        </button>
        <div className="monthlyItemDays">
          <span className="monthlyItemDayBadge">{task.dayOfMonth}日</span>
        </div>
      </article>
    );
  }

  function renderScheduledInboxTask(task: PriorityTask) {
    return (
      <article className="taskItem scheduledInboxTask" key={task.id}>
        <button
          className="checkButton"
          type="button"
          onClick={() => completeInboxTask(task.id)}
          aria-label={`${task.title || "無題のタスク"}を完了`}
        >
          ✓
        </button>
        <div className="taskTitleView">{task.title || " "}</div>
        {task.scheduledDate && <time className="scheduledInboxDate" dateTime={task.scheduledDate}>{task.scheduledDate.slice(5).replace("-", "/")}</time>}
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
                placeholder={`${getGoalLabel("year", periodOffsets.year, periodLabels.year)}を入力してください`}
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
                  placeholder={`${getGoalLabel("month", periodOffsets.month, periodLabels.month)}を入力してください`}
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
                    placeholder={`${getGoalLabel("week", periodOffsets.week, periodLabels.week)}を入力してください`}
                    value={planner.goalsByPeriod.week[periodKeys.week] || ""}
                    onChange={(event) => updateGoal("week", event.target.value)}
                  />
                </section>
              </section>
            </section>
          </div>
        </section>

        <section className="homeColumn homeTabWorkspace" aria-label="タスクの切り替え">
          <div className="tabList homeTabList" role="tablist" aria-label="タブ切り替え">
            {homeTabs.map((tab) => {
              const isActive = selectedHomeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  className={isActive ? "tabButton active" : "tabButton"}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedHomeTab(tab.key)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {showTodayTab && (
            <section className="homeTabPanel todayLayout" aria-label="今日のタスク">
              <div className="todayTaskLayout" aria-label="今日のタスク">
                <div className="todayRecurringColumn">
                <section className="dailySectionCard recurringDailySection" aria-label="毎日のタスク">
                  <div className="sectionHeader">
                    <h3>毎日のタスク</h3>
                  </div>
                  <div className="dailyGroupGrid">
                    {dailyTaskGroupsByTime
                      .filter((group) => group.pattern === todayDailyPattern)
                      .map(renderTodayDailyGroup)}
                  </div>
                </section>

                <section className="weeklySection" aria-label="毎週のタスク">
                  <div className="sectionHeader">
                    <h3>毎週のタスク</h3>
                    <span className="sectionMeta">{getWeekdayLabel(new Date().getDay())}</span>
                  </div>
                  <div className="taskList">
                    {planner.weeklyTasks.filter((task) => task.weekday === new Date().getDay()).length === 0 && (
                      <p className="emptyText">毎週のタスクはありません。</p>
                    )}
                    {planner.weeklyTasks
                      .filter((task) => task.weekday === new Date().getDay())
                      .map((task) => renderWeeklyTask(task, new Date().getDay()))}
                  </div>
                </section>

                <section className="monthlySection" aria-label="毎月のタスク">
                  <div className="sectionHeader">
                    <h3>毎月のタスク</h3>
                    <span className="sectionMeta">{new Date().getDate()}日</span>
                  </div>
                  <div className="taskList">
                    {planner.monthlyTasks.filter((task) => task.dayOfMonth === new Date().getDate()).length === 0 && (
                      <p className="emptyText">毎月のタスクはありません。</p>
                    )}
                    {planner.monthlyTasks
                      .filter((task) => task.dayOfMonth === new Date().getDate())
                      .map((task) => renderMonthlyTask(task, new Date().getDate()))}
                  </div>
                </section>
                </div>

                <aside className="todayTaskColumn" aria-label="実行日を指定したInboxタスク">
                  {hasOverdueTasks && (
                    <section className="todayOverdueSection" aria-label="期限切れタスク">
                      <div className="sectionHeader"><h3>期限切れタスク</h3></div>
                      <div className="taskList">
                        {overdueWeeklyTasks.map((task) => renderWeeklyTask(task, task.weekday))}
                        {overdueMonthlyTasks.map((task) => renderMonthlyTask(task, task.dayOfMonth))}
                        {overdueInboxTasks.map(renderScheduledInboxTask)}
                      </div>
                    </section>
                  )}
                  <div className="todayScheduledGroup" aria-label="今日・今週・今月のタスク">
                    <section className="todayTaskSection todayTaskTodaySection">
                      <div className="sectionHeader"><h3>今日のタスク</h3></div>
                      <div className="taskList">{todayInboxTasks.length ? todayInboxTasks.map(renderScheduledInboxTask) : <p className="emptyText">今日のタスクはありません。</p>}</div>
                    </section>
                    <section className="todayTaskSection todayTaskWeekSection">
                      <div className="sectionHeader"><h3>今週のタスク</h3></div>
                      <div className="taskList">{weekInboxTasks.length ? weekInboxTasks.map(renderScheduledInboxTask) : <p className="emptyText">今週のタスクはありません。</p>}</div>
                    </section>
                    <section className="todayTaskSection todayTaskMonthSection">
                      <div className="sectionHeader"><h3>今月のタスク</h3></div>
                      <div className="taskList">{monthInboxTasks.length ? monthInboxTasks.map(renderScheduledInboxTask) : <p className="emptyText">今月のタスクはありません。</p>}</div>
                    </section>
                  </div>
                </aside>
              </div>
            </section>
          )}

          {showRecurringTab && (
            <section className="homeTabPanel recurringColumn" aria-label="繰り返しタスク">
              <div className="recurringGrid" aria-label="繰り返しタスクの編集">
                <section className="dailySectionCard recurringDailySection" aria-label="毎日のタスク">
                  <div className="sectionHeader dailyPatternHeader">
                    <h3>毎日のタスク</h3>
                    <div className="dailyPatternTabs" role="tablist" aria-label="毎日タスクのパターン">
                      <button className={selectedDailyPattern === "work" ? "active" : undefined} type="button" role="tab" aria-selected={selectedDailyPattern === "work"} onClick={() => setSelectedDailyPattern("work")}>仕事</button>
                      <button className={selectedDailyPattern === "holiday" ? "active" : undefined} type="button" role="tab" aria-selected={selectedDailyPattern === "holiday"} onClick={() => setSelectedDailyPattern("holiday")}>休日</button>
                    </div>
                  </div>
                  {renderDailyPatternWeekdayToggles()}
                  <button className="recurringAddButton" type="button" onClick={() => setIsDailyGroupModalOpen(true)} aria-label="グループを追加">＋</button>
                  <div className="dailyGroupGrid">
                    {dailyTaskGroupsByTime.filter((group) => group.pattern === selectedDailyPattern).map((group) =>
                      renderDailyTaskGroup(group, selectedDailyPattern),
                    )}
                  </div>
                </section>

                <div className="recurringStack">
                  <section className="weeklySection" aria-label="毎週のタスク">
                    <div className="sectionHeader">
                      <h3>毎週のタスク</h3>
                    </div>
                    <form
                      className="taskForm weeklyTaskForm"
                      onSubmit={(event) => {
                        event.preventDefault();
                        addWeeklyTask();
                      }}
                    >
                      <input
                        aria-label="毎週のタスクを追加"
                        placeholder="毎週のタスク"
                        value={newWeeklyTaskTitle}
                        onChange={(event) => setNewWeeklyTaskTitle(event.target.value)}
                      />
                      <button
                        className="recurringAddButton"
                        type="submit"
                        aria-label="毎週のタスクを追加"
                      >
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
                        <p className="emptyText">毎週のタスクはありません。</p>
                      )}
                      {planner.weeklyTasks
                        .filter((task) => task.weekday === selectedWeeklyWeekday)
                        .map((task) =>
                          renderWeeklyTask(task, selectedWeeklyWeekday, false),
                        )}
                    </div>
                  </section>

                  <section className="monthlySection" aria-label="毎月のタスク">
                    <div className="sectionHeader">
                      <h3>毎月のタスク</h3>
                    </div>
                    <form
                      className="taskForm monthlyTaskForm"
                      onSubmit={(event) => {
                        event.preventDefault();
                        addMonthlyTask();
                      }}
                    >
                      <input
                        aria-label="毎月のタスクを追加"
                        placeholder="毎月のタスク"
                        value={newMonthlyTaskTitle}
                        onChange={(event) => setNewMonthlyTaskTitle(event.target.value)}
                      />
                      <button
                        className="recurringAddButton"
                        type="submit"
                        aria-label="毎月のタスクを追加"
                      >
                        +
                      </button>
                      <div className="monthlyTaskFormDays">
                        {renderMonthdayToggles(
                          selectedMonthlyDay,
                          toggleSelectedMonthlyDay,
                        )}
                      </div>
                    </form>
                    <div className="taskList">
                      {planner.monthlyTasks.filter((task) => task.dayOfMonth === selectedMonthlyDay).length === 0 && (
                        <p className="emptyText">毎月のタスクはありません。</p>
                      )}
                      {planner.monthlyTasks
                        .filter((task) => task.dayOfMonth === selectedMonthlyDay)
                        .map((task) =>
                          renderMonthlyTask(task, selectedMonthlyDay, false),
                        )}
                    </div>
                  </section>
                </div>
              </div>
            </section>
          )}


          {showInboxTab && (
            <section className="homeTabPanel todayInboxSection" aria-label="Inboxのタスク">
              <div className="sectionHeader">
                <h3>Inbox</h3>
              </div>
              <form
                className="taskForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  addInboxTask();
                }}
              >
                <input
                  aria-label="Inboxのタスクを追加"
                  placeholder="Inboxタスク"
                  value={newInboxTaskTitle}
                  onChange={(event) => setNewInboxTaskTitle(event.target.value)}
                />
                <button type="submit" aria-label="Inboxのタスクを追加">
                  +
                </button>
              </form>
              <div className="taskList">
                {planner.inboxTasks.length === 0 && (
                  <p className="emptyText">Inboxタスクはありません。</p>
                )}
                {planner.inboxTasks.map((task) => (
                  <article className={task.done ? "taskItem done inboxTaskItem" : "taskItem inboxTaskItem"} key={task.id}>
                    {(() => {
                      const editTarget = { kind: "inbox", id: task.id } as const;
                      const isEditing = isTaskBeingEdited(editTarget);
                      return (
                        <>
                          <button
                            className="checkButton"
                            type="button"
                            onClick={() => completeInboxTask(task.id)}
                            aria-label={`${task.title || "無題のタスク"}を完了`}
                          >
                            ✓
                          </button>
                          {isEditing ? (
                            <textarea
                              aria-label="Inboxタスク"
                              value={task.title}
                              onChange={(event) =>
                                updateInboxTaskTitle(task.id, event.target.value)
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
                          <input
                            className="inboxTaskDate"
                            type="date"
                            aria-label={`${task.title || "Inboxタスク"}の実行日`}
                            value={task.scheduledDate || ""}
                            onChange={(event) => updateInboxTaskScheduledDate(task.id, event.currentTarget.value)}
                          />
                        </>
                      );
                    })()}
                  </article>
                ))}
              </div>
            </section>
          )}

          {showDiaryTab && (
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
          )}
        </section>
      </section>

      <aside className="currentTaskModal" aria-live="polite" aria-label="現在のタスク">
        <time dateTime={currentTimeValue}>{formatTimeLabel(currentTimeValue)}</time>
        <strong>{currentDailyTaskEntry ? `${formatTimeLabel(currentDailyTaskEntry.task.time)}開始 ${currentDailyTaskEntry.task.title || "無題のタスク"}` : "現在のタスクはありません"}</strong>
        {currentDailyTaskEntry && (
          <button
            className="currentTaskCompleteButton"
            type="button"
            onClick={() => toggleDailyTask(currentDailyTaskEntry.group.key, currentDailyTaskEntry.task.id)}
          >
            完了
          </button>
        )}
      </aside>

      {isDailyGroupModalOpen && (
        <div className="dailyGroupModalBackdrop" role="presentation">
          <form className="dailyGroupCreateModal" onSubmit={(event) => { event.preventDefault(); addDailyTaskGroup(); }}>
            <h2>グループを追加</h2>
            <div className="dailyGroupNameTimeFields"><input aria-label="グループ名" placeholder="グループ名" value={newDailyGroupTitle} onChange={(event) => setNewDailyGroupTitle(event.currentTarget.value)} autoFocus /><input aria-label="開始時刻" type="time" value={newDailyGroupStartTime} onChange={(event) => setNewDailyGroupStartTime(event.currentTarget.value)} /><span>〜</span><input aria-label="終了時刻" type="time" value={newDailyGroupEndTime} onChange={(event) => setNewDailyGroupEndTime(event.currentTarget.value)} /></div>
            <input aria-label="テーマ" placeholder="テーマ" value={newDailyGroupTheme} onChange={(event) => setNewDailyGroupTheme(event.currentTarget.value)} />
            <div className="dailyGroupModalActions"><button type="button" onClick={() => setIsDailyGroupModalOpen(false)}>キャンセル</button><button type="submit">追加</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
