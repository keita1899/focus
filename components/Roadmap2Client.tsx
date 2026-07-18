"use client";

import { useEffect, useMemo, useState } from "react";

type Roadmap2ListKey = "focusItems" | "choreItems" | "seasonalItems";

type Roadmap2Month = {
  month: number;
  goal: string;
  focusItems: string[];
  choreItems: string[];
  seasonalItems: string[];
};

type Roadmap2Year = {
  annualGoal: string;
  months: Roadmap2Month[];
};

type Roadmap2State = {
  selectedYear: number;
  years: Record<string, Roadmap2Year>;
};

type Roadmap2ClientProps = {
  initialValue: unknown;
};

const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);

const listMeta: Array<{
  key: Roadmap2ListKey;
  title: string;
  placeholder: string;
}> = [
  { key: "focusItems", title: "やるべきこと", placeholder: "今月進めること" },
  { key: "choreItems", title: "雑務的なタスク", placeholder: "雑務・事務タスク" },
  { key: "seasonalItems", title: "季節のイベントや趣味", placeholder: "イベント・趣味" },
];

function createMonth(month: number): Roadmap2Month {
  return {
    month,
    goal: "",
    focusItems: [""],
    choreItems: [""],
    seasonalItems: [""],
  };
}

function createYearPlan(): Roadmap2Year {
  return {
    annualGoal: "",
    months: Array.from({ length: 12 }, (_, index) => createMonth(index + 1)),
  };
}

function createInitialRoadmap2State(): Roadmap2State {
  const year = new Date().getFullYear();
  return {
    selectedYear: year,
    years: {
      [String(year)]: createYearPlan(),
    },
  };
}

function normalizeMonth(value: unknown, month: number): Roadmap2Month {
  const source = value && typeof value === "object" ? (value as Partial<Roadmap2Month>) : {};
  const normalizedMonth =
    typeof source.month === "number" && source.month >= 1 && source.month <= 12
      ? source.month
      : month;

  function normalizeItems(items: unknown) {
    if (!Array.isArray(items)) return [""];
    const nextItems = items.map((item) => (typeof item === "string" ? item : ""));
    return nextItems.length > 0 ? nextItems : [""];
  }

  return {
    month: normalizedMonth,
    goal: typeof source.goal === "string" ? source.goal : "",
    focusItems: normalizeItems(source.focusItems),
    choreItems: normalizeItems(source.choreItems),
    seasonalItems: normalizeItems(source.seasonalItems),
  };
}

function normalizeYearPlan(value: unknown): Roadmap2Year {
  const source = value && typeof value === "object" ? (value as Partial<Roadmap2Year>) : {};
  const rawMonths = Array.isArray(source.months) ? source.months : [];

  return {
    annualGoal: typeof source.annualGoal === "string" ? source.annualGoal : "",
    months: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const existing = rawMonths.find((item) => {
        if (!item || typeof item !== "object") return false;
        return (item as Partial<Roadmap2Month>).month === month;
      });
      return normalizeMonth(existing, month);
    }),
  };
}

function normalizeRoadmap2State(value: unknown): Roadmap2State {
  if (!value || typeof value !== "object") {
    return createInitialRoadmap2State();
  }

  const source = value as Partial<Roadmap2State>;
  const selectedYear =
    typeof source.selectedYear === "number" && Number.isInteger(source.selectedYear)
      ? source.selectedYear
      : new Date().getFullYear();
  const rawYears = source.years && typeof source.years === "object" ? source.years : {};
  const years = Object.fromEntries(
    Object.entries(rawYears).map(([yearKey, yearValue]) => [
      yearKey,
      normalizeYearPlan(yearValue),
    ]),
  );

  if (!years[String(selectedYear)]) {
    years[String(selectedYear)] = createYearPlan();
  }

  return { selectedYear, years };
}

export default function Roadmap2Client({ initialValue }: Roadmap2ClientProps) {
  const [roadmap, setRoadmap] = useState<Roadmap2State>(() =>
    normalizeRoadmap2State(initialValue),
  );

  const activeYearKey = String(roadmap.selectedYear);
  const activeYear = useMemo(
    () => roadmap.years[activeYearKey] || createYearPlan(),
    [activeYearKey, roadmap.years],
  );

  useEffect(() => {
    fetch("/api/roadmap2", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roadmap),
    }).catch(() => undefined);
  }, [roadmap]);

  function ensureYear(year: number) {
    setRoadmap((current) => ({
      selectedYear: year,
      years: current.years[String(year)]
        ? current.years
        : { ...current.years, [String(year)]: createYearPlan() },
    }));
  }

  function updateActiveYear(updater: (current: Roadmap2Year) => Roadmap2Year) {
    setRoadmap((current) => ({
      ...current,
      years: {
        ...current.years,
        [String(current.selectedYear)]: updater(
          current.years[String(current.selectedYear)] || createYearPlan(),
        ),
      },
    }));
  }

  function updateAnnualGoal(value: string) {
    updateActiveYear((current) => ({ ...current, annualGoal: value }));
  }

  function updateMonthGoal(month: number, goal: string) {
    updateActiveYear((current) => ({
      ...current,
      months: current.months.map((item) =>
        item.month === month ? { ...item, goal } : item,
      ),
    }));
  }

  function updateListItem(
    month: number,
    listKey: Roadmap2ListKey,
    index: number,
    value: string,
  ) {
    updateActiveYear((current) => ({
      ...current,
      months: current.months.map((item) => {
        if (item.month !== month) return item;
        const nextItems = item[listKey].map((entry, entryIndex) =>
          entryIndex === index ? value : entry,
        );
        return { ...item, [listKey]: nextItems };
      }),
    }));
  }

  function addListItem(month: number, listKey: Roadmap2ListKey) {
    updateActiveYear((current) => ({
      ...current,
      months: current.months.map((item) =>
        item.month === month
          ? { ...item, [listKey]: [...item[listKey], ""] }
          : item,
      ),
    }));
  }

  function removeListItem(month: number, listKey: Roadmap2ListKey, index: number) {
    updateActiveYear((current) => ({
      ...current,
      months: current.months.map((item) => {
        if (item.month !== month) return item;
        const nextItems = item[listKey].filter((_, entryIndex) => entryIndex !== index);
        return {
          ...item,
          [listKey]: nextItems.length > 0 ? nextItems : [""],
        };
      }),
    }));
  }

  return (
    <main className="shell roadmap2Page">
      <section className="roadmapHeader roadmap2Header" aria-label="ロードマップ2">
        <div>
          <h1>Roadmap 2</h1>
        </div>
        <div className="roadmap2YearSwitcher" aria-label="年の切り替え">
          <button
            type="button"
            onClick={() => ensureYear(roadmap.selectedYear - 1)}
            aria-label="前年へ"
          >
            &lt;
          </button>
          <strong>{roadmap.selectedYear}年</strong>
          <button
            type="button"
            onClick={() => ensureYear(roadmap.selectedYear + 1)}
            aria-label="翌年へ"
          >
            &gt;
          </button>
        </div>
      </section>

      <section className="roadmap2AnnualCard" aria-label="年間目標">
        <header className="sectionHeader">
          <h2>年間目標</h2>
        </header>
        <textarea
          className="roadmap2AnnualInput"
          aria-label="年間目標"
          placeholder="この年を通して達成したいこと"
          rows={2}
          value={activeYear.annualGoal}
          onChange={(event) => updateAnnualGoal(event.target.value)}
        />
      </section>

      <div className="roadmap2MonthList">
        {activeYear.months.map((month) => (
          <section className="roadmap2MonthCard" key={month.month} aria-label={`${month.month}月`}>
            <header className="roadmap2MonthHeader">
              <h2>{monthLabels[month.month - 1]}</h2>
            </header>

            <div className="roadmap2GoalRow">
              <label className="roadmap2GoalLabel" htmlFor={`roadmap2-goal-${month.month}`}>
                月間目標
              </label>
              <textarea
                id={`roadmap2-goal-${month.month}`}
                className="roadmap2GoalInput"
                placeholder={`${month.month}月の目標`}
                rows={2}
                value={month.goal}
                onChange={(event) => updateMonthGoal(month.month, event.target.value)}
              />
            </div>

            <div className="roadmap2Columns">
              {listMeta.map((list) => (
                <section className="roadmap2ListCard" key={list.key}>
                  <header className="roadmap2ListHeader">
                    <h3>{list.title}</h3>
                    <button
                      type="button"
                      className="roadmap2AddButton"
                      onClick={() => addListItem(month.month, list.key)}
                      aria-label={`${monthLabels[month.month - 1]}の${list.title}を追加`}
                    >
                      +
                    </button>
                  </header>
                  <div className="roadmap2ItemList">
                    {month[list.key].map((item, index) => (
                      <div className="roadmap2ItemRow" key={`${month.month}-${list.key}-${index}`}>
                        <textarea
                          aria-label={`${monthLabels[month.month - 1]}の${list.title}`}
                          placeholder={list.placeholder}
                          rows={2}
                          value={item}
                          onChange={(event) =>
                            updateListItem(month.month, list.key, index, event.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="roadmap2RemoveButton"
                          onClick={() => removeListItem(month.month, list.key, index)}
                          aria-label={`${monthLabels[month.month - 1]}の${list.title}を削除`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
