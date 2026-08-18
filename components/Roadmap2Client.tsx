"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Roadmap2Month = {
  month: number;
  goal: string;
};

type Roadmap2Year = {
  annualGoals: string[];
  months: Roadmap2Month[];
};

type Roadmap2State = {
  selectedYear: number;
  years: Record<string, Roadmap2Year>;
};

type PlannerGoals = {
  goalsByPeriod?: { month?: Record<string, string> };
  annualGoalsByPeriod?: Record<string, string[]>;
};

type Roadmap2ClientProps = {
  initialValue: unknown;
  initialPlannerValue: unknown;
};

const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);

function createMonth(month: number): Roadmap2Month {
  return { month, goal: "" };
}

function createYearPlan(): Roadmap2Year {
  return {
    annualGoals: [""],
    months: Array.from({ length: 12 }, (_, index) => createMonth(index + 1)),
  };
}

function createInitialRoadmap2State(): Roadmap2State {
  const year = new Date().getFullYear();
  return { selectedYear: year, years: { [String(year)]: createYearPlan() } };
}

function normalizeMonth(value: unknown, month: number): Roadmap2Month {
  const source = value && typeof value === "object" ? (value as Partial<Roadmap2Month>) : {};
  return {
    month,
    goal: typeof source.goal === "string" ? source.goal : "",
  };
}

function normalizeYearPlan(value: unknown): Roadmap2Year {
  const source = value && typeof value === "object" ? (value as { annualGoals?: unknown; annualGoal?: unknown; months?: unknown }) : {};
  const rawGoals = Array.isArray(source.annualGoals)
    ? source.annualGoals.filter((goal): goal is string => typeof goal === "string")
    : typeof source.annualGoal === "string"
      ? [source.annualGoal]
      : [];
  const rawMonths = Array.isArray(source.months) ? source.months : [];

  return {
    annualGoals: (rawGoals.length ? rawGoals : [""]).slice(0, 5),
    months: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const existing = rawMonths.find(
        (item) => item && typeof item === "object" && (item as Partial<Roadmap2Month>).month === month,
      );
      return normalizeMonth(existing, month);
    }),
  };
}

function normalizeRoadmap2State(value: unknown, plannerValue: unknown): Roadmap2State {
  const fallback = createInitialRoadmap2State();
  const source = value && typeof value === "object" ? (value as Partial<Roadmap2State>) : {};
  const selectedYear = typeof source.selectedYear === "number" && Number.isInteger(source.selectedYear)
    ? source.selectedYear
    : fallback.selectedYear;
  const rawYears = source.years && typeof source.years === "object" ? source.years : {};
  const years = Object.fromEntries(
    Object.entries(rawYears).map(([year, plan]) => [year, normalizeYearPlan(plan)]),
  );
  const planner = plannerValue && typeof plannerValue === "object" ? plannerValue as PlannerGoals : {};

  Object.entries(planner.annualGoalsByPeriod || {}).forEach(([year, goals]) => {
    const plan = years[year] || createYearPlan();
    years[year] = { ...plan, annualGoals: (goals.length ? goals : [""]).slice(0, 5) };
  });
  Object.entries(planner.goalsByPeriod?.month || {}).forEach(([monthKey, goal]) => {
    const [year, monthValue] = monthKey.split("-");
    const month = Number(monthValue);
    if (!Number.isInteger(month) || month < 1 || month > 12) return;
    const plan = years[year] || createYearPlan();
    years[year] = {
      ...plan,
      months: plan.months.map((item) => item.month === month ? { ...item, goal } : item),
    };
  });

  if (!years[String(selectedYear)]) years[String(selectedYear)] = createYearPlan();
  return { selectedYear, years };
}

export default function Roadmap2Client({ initialValue, initialPlannerValue }: Roadmap2ClientProps) {
  const [roadmap, setRoadmap] = useState<Roadmap2State>(() => normalizeRoadmap2State(initialValue, initialPlannerValue));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [isComposing, setIsComposing] = useState(false);
  const hasMountedRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const activeYearKey = String(roadmap.selectedYear);
  const activeYear = useMemo(() => roadmap.years[activeYearKey] || createYearPlan(), [activeYearKey, roadmap.years]);
  const selectedMonthPlan = useMemo(
    () => activeYear.months.find((month) => month.month === selectedMonth) || createMonth(selectedMonth),
    [activeYear.months, selectedMonth],
  );
  const today = new Date();
  const isPastMonth = (month: number) => roadmap.selectedYear < today.getFullYear() || (roadmap.selectedYear === today.getFullYear() && month < today.getMonth() + 1);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isComposing) return;
    const timeoutId = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
        const response = await fetch("/api/roadmap2", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roadmap),
        });
        if (!response.ok) throw new Error("ロードマップの保存に失敗しました。");
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [isComposing, roadmap]);

  function ensureYear(year: number) {
    setRoadmap((current) => ({
      selectedYear: year,
      years: current.years[String(year)] ? current.years : { ...current.years, [String(year)]: createYearPlan() },
    }));
  }

  function updateActiveYear(updater: (current: Roadmap2Year) => Roadmap2Year) {
    setRoadmap((current) => ({
      ...current,
      years: { ...current.years, [String(current.selectedYear)]: updater(current.years[String(current.selectedYear)] || createYearPlan()) },
    }));
  }

  function updateAnnualGoal(index: number, value: string) {
    updateActiveYear((current) => ({
      ...current,
      annualGoals: current.annualGoals.map((goal, goalIndex) => goalIndex === index ? value : goal),
    }));
  }

  function addAnnualGoal() {
    updateActiveYear((current) => current.annualGoals.length >= 5 ? current : { ...current, annualGoals: [...current.annualGoals, ""] });
  }

  function removeAnnualGoal(index: number) {
    updateActiveYear((current) => {
      const annualGoals = current.annualGoals.filter((_, goalIndex) => goalIndex !== index);
      return { ...current, annualGoals: annualGoals.length ? annualGoals : [""] };
    });
  }

  function updateMonthGoal(month: number, goal: string) {
    updateActiveYear((current) => ({
      ...current,
      months: current.months.map((item) => item.month === month ? { ...item, goal } : item),
    }));
  }

  return (
    <main className="shell roadmap2Page">
      <section className="roadmapHeader roadmap2Header" aria-label="年間ロードマップ">
        <h1>年間ロードマップ</h1>
        <div className="roadmap2YearSwitcher" aria-label="年の切り替え">
          <button type="button" onClick={() => ensureYear(roadmap.selectedYear - 1)} aria-label="前年へ">&lt;</button>
          <strong>{roadmap.selectedYear}年</strong>
          <button type="button" onClick={() => ensureYear(roadmap.selectedYear + 1)} aria-label="翌年へ">&gt;</button>
        </div>
      </section>

      <section className="roadmap2AnnualCard" aria-label="年間目標">
        <header className="sectionHeader"><h2>年間目標</h2></header>
        <div className="roadmap2AnnualGoalList">
          {activeYear.annualGoals.map((goal, index) => (
            <div className="roadmap2AnnualGoalRow" key={`${activeYearKey}-${index}`}>
              <span aria-hidden="true">{index + 1}.</span>
              <input
                aria-label={`年間目標 ${index + 1}`}
                placeholder="この年を通して達成したいこと"
                value={goal}
                onChange={(event) => updateAnnualGoal(index, event.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(event) => { setIsComposing(false); updateAnnualGoal(index, event.currentTarget.value); }}
              />
              <button type="button" className="roadmap2RemoveButton" onClick={() => removeAnnualGoal(index)} aria-label={`年間目標 ${index + 1}を削除`}>×</button>
            </div>
          ))}
        </div>
        {activeYear.annualGoals.length < 5 && <button type="button" className="roadmap2AnnualAddButton" onClick={addAnnualGoal}>＋ 目標を追加</button>}
      </section>

      <nav className="roadmap2MonthPicker" aria-label="月を選択">
        {monthLabels.map((label, index) => {
          const month = index + 1;
          return <button type="button" key={month} className={selectedMonth === month ? "isActive" : isPastMonth(month) ? "isPast" : undefined} aria-pressed={selectedMonth === month} onClick={() => setSelectedMonth(month)}>{label}</button>;
        })}
      </nav>

      <section className="roadmap2SelectedMonth roadmap2MonthCard" aria-label={`${selectedMonth}月`}>
        <header className="roadmap2MonthHeader"><h2>{monthLabels[selectedMonth - 1]}</h2></header>
        <div className="roadmap2GoalRow">
          <label className="roadmap2GoalLabel" htmlFor={`roadmap2-goal-${roadmap.selectedYear}-${selectedMonth}`}>月間目標</label>
          <input
            id={`roadmap2-goal-${roadmap.selectedYear}-${selectedMonth}`}
            className="roadmap2GoalInput"
            aria-label="月間目標"
            placeholder={`${selectedMonth}月の目標`}
            value={selectedMonthPlan.goal}
            onChange={(event) => updateMonthGoal(selectedMonth, event.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => { setIsComposing(false); updateMonthGoal(selectedMonth, event.currentTarget.value); }}
          />
        </div>
      </section>
    </main>
  );
}
