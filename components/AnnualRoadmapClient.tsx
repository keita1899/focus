"use client";

import { useEffect, useRef, useState } from "react";

type MonthPlan = { theme: string; mustDo: string[]; chores: string[]; other: string[] };
type YearPlan = { title: string; themes: string[]; months: Record<string, MonthPlan> };
type RoadmapState = { years: Record<string, YearPlan> };
type TaskKind = "mustDo" | "chores" | "other";

const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const taskLabels: Record<TaskKind, string> = { mustDo: "やるべきこと", chores: "雑務タスク", other: "その他" };

function createMonthPlan(): MonthPlan { return { theme: "", mustDo: [""], chores: [""], other: [""] }; }
function createYearPlan(): YearPlan { return { title: "", themes: ["", "", ""], months: Object.fromEntries(monthLabels.map((_, index) => [String(index + 1), createMonthPlan()])) }; }
function normalizeState(value: unknown, currentYear: number): RoadmapState {
  const source = value && typeof value === "object" ? value as Partial<RoadmapState> : {};
  const years: Record<string, YearPlan> = {};
  Object.entries(source.years || {}).forEach(([year, raw]) => {
    const plan = raw && typeof raw === "object" ? raw as Partial<YearPlan> : {};
    const rawMonths = plan.months && typeof plan.months === "object" ? plan.months : {};
    years[year] = {
      title: typeof plan.title === "string" ? plan.title : "",
      themes: Array.from({ length: 3 }, (_, index) => Array.isArray(plan.themes) && typeof plan.themes[index] === "string" ? plan.themes[index] : ""),
      months: Object.fromEntries(monthLabels.map((_, index) => {
        const rawMonth = rawMonths[String(index + 1)] as Partial<MonthPlan> | undefined;
        const tasks = (kind: TaskKind) => Array.isArray(rawMonth?.[kind]) ? rawMonth![kind]!.filter((task): task is string => typeof task === "string") : [""];
        return [String(index + 1), { theme: typeof rawMonth?.theme === "string" ? rawMonth.theme : "", mustDo: tasks("mustDo"), chores: tasks("chores"), other: tasks("other") }];
      })),
    };
  });
  if (!years[String(currentYear)]) years[String(currentYear)] = createYearPlan();
  return { years };
}

function saveRoadmap(value: string) { return fetch("/api/annual-roadmap", { method: "PUT", headers: { "Content-Type": "application/json" }, body: value, keepalive: true }).catch(() => undefined); }

export default function AnnualRoadmapClient({ initialValue, birthday = "" }: { initialValue: unknown; birthday?: string }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [roadmap, setRoadmap] = useState(() => normalizeState(initialValue, currentYear));
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(() => ({ [String(new Date().getMonth() + 1)]: true }));
  const roadmapRef = useRef(roadmap); roadmapRef.current = roadmap;
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef<string | null>(null);
  const yearPlan = roadmap.years[String(selectedYear)] || createYearPlan();
  const birthYear = Number(birthday.slice(0, 4));
  const age = birthYear ? selectedYear - birthYear : null;
  const currentMonth = new Date().getMonth() + 1;
  const orderedMonths = Array.from({ length: 12 }, (_, index) => ((currentMonth - 1 + index) % 12) + 1);

  function enqueue(value: string) {
    if (pendingRef.current === value) return;
    pendingRef.current = value;
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => { await saveRoadmap(value); if (pendingRef.current === value) pendingRef.current = null; });
  }
  function update(updater: (current: RoadmapState) => RoadmapState) {
    const next = updater(roadmapRef.current); roadmapRef.current = next; setRoadmap(next); enqueue(JSON.stringify(next));
  }
  useEffect(() => () => enqueue(JSON.stringify(roadmapRef.current)), []);
  function changeYear(direction: -1 | 1) {
    const nextYear = selectedYear + direction; setSelectedYear(nextYear);
    update((current) => current.years[String(nextYear)] ? current : { ...current, years: { ...current.years, [String(nextYear)]: createYearPlan() } });
  }
  function updateYear(value: Partial<YearPlan>) { update((current) => ({ ...current, years: { ...current.years, [String(selectedYear)]: { ...yearPlan, ...value } } })); }
  function updateMonth(month: string, value: Partial<MonthPlan>) { update((current) => ({ ...current, years: { ...current.years, [String(selectedYear)]: { ...yearPlan, months: { ...yearPlan.months, [month]: { ...yearPlan.months[month], ...value } } } } })); }
  function updateTask(month: string, kind: TaskKind, index: number, value: string) { const tasks = [...yearPlan.months[month][kind]]; tasks[index] = value; updateMonth(month, { [kind]: tasks }); }
  function addTask(month: string, kind: TaskKind) { updateMonth(month, { [kind]: [...yearPlan.months[month][kind], ""] }); }
  function removeTask(month: string, kind: TaskKind, index: number) { const tasks = yearPlan.months[month][kind].filter((_, taskIndex) => taskIndex !== index); updateMonth(month, { [kind]: tasks.length ? tasks : [""] }); }
  function taskGroup(month: string, kind: TaskKind) {
    const tasks = yearPlan.months[month][kind];
    return <section className="annualRoadmapTaskGroup" key={kind}><h3>{taskLabels[kind]}</h3>{tasks.map((task, taskIndex) => <div className="annualRoadmapTask" key={taskIndex}><span aria-hidden="true" /><input value={task} placeholder={taskLabels[kind]} onChange={(event) => updateTask(month, kind, taskIndex, event.target.value)} /><button type="button" onClick={() => removeTask(month, kind, taskIndex)} aria-label={`${taskLabels[kind]}を削除`}>×</button></div>)}<button className="annualRoadmapAddTask" type="button" onClick={() => addTask(month, kind)}>＋ タスクを追加</button></section>;
  }

  return <main className="shell roadmapPage annualRoadmapPage">
    <div className="annualRoadmapToolbar"><div className="annualRoadmapYearSwitcher"><button type="button" onClick={() => changeYear(-1)} aria-label="前年へ">&lt;</button><strong>{selectedYear}年</strong>{age !== null && <span>{age}歳</span>}<button type="button" onClick={() => changeYear(1)} aria-label="翌年へ">&gt;</button></div></div>
    <section className="annualRoadmapForm"><label className="annualRoadmapTitleField">タイトル<input value={yearPlan.title} placeholder="この年のロードマップ" onChange={(event) => updateYear({ title: event.target.value })} /></label><fieldset><legend>年間テーマ</legend>{yearPlan.themes.map((theme, index) => <input key={index} value={theme} placeholder={`テーマ ${index + 1}`} onChange={(event) => { const themes = [...yearPlan.themes]; themes[index] = event.target.value; updateYear({ themes }); }} />)}</fieldset></section>
    <div className="annualRoadmapMonths">{orderedMonths.map((monthNumber) => { const month = String(monthNumber); const label = `${month}月`; const plan = yearPlan.months[month]; const isOpen = Boolean(openMonths[month]); const isCompletedMonthsStart = monthNumber === 1 && currentMonth !== 1; return <section className={`annualRoadmapMonth${isCompletedMonthsStart ? " isCompletedMonthsStart" : ""}`} key={month}><button className="annualRoadmapMonthHeader" type="button" onClick={() => setOpenMonths((current) => ({ ...current, [month]: !isOpen }))} aria-expanded={isOpen}><strong>{label}</strong>{plan.theme && <span>{plan.theme}</span>}<b>{isOpen ? "⌃" : "⌄"}</b></button>{isOpen && <div className="annualRoadmapMonthBody"><label>月間テーマ<input value={plan.theme} onChange={(event) => updateMonth(month, { theme: event.target.value })} /></label>{taskGroup(month, "mustDo")}<div className="annualRoadmapTaskColumns">{taskGroup(month, "chores")}{taskGroup(month, "other")}</div></div>}</section>; })}</div>
  </main>;
}
