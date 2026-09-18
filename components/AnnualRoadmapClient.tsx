"use client";

import { useEffect, useRef, useState } from "react";

type RoadmapTask = { id: string; title: string; children: RoadmapTask[] };
type MonthPlan = { theme: string; mustDo: RoadmapTask[]; chores: string[]; other: string[] };
type YearPlan = { title: string; themes: string[]; months: Record<string, MonthPlan> };
type RoadmapState = { years: Record<string, YearPlan> };
type TaskKind = "mustDo" | "chores" | "other";

const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const taskLabels: Record<TaskKind, string> = { mustDo: "やるべきこと", chores: "雑務タスク", other: "その他" };

function createTask(): RoadmapTask { return { id: `roadmap-task-${Date.now()}-${Math.random().toString(16).slice(2)}`, title: "", children: [] }; }
function createMonthPlan(): MonthPlan { return { theme: "", mustDo: [createTask()], chores: [""], other: [""] }; }
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
        const tasks = (kind: Exclude<TaskKind, "mustDo">) => Array.isArray(rawMonth?.[kind]) ? rawMonth![kind]!.filter((task): task is string => typeof task === "string") : [""];
        const mustDo = Array.isArray(rawMonth?.mustDo) ? rawMonth!.mustDo!.map((task, taskIndex) => {
          if (typeof task === "string") return { id: `legacy-${year}-${index}-${taskIndex}`, title: task, children: [] };
          const item = task as Partial<RoadmapTask>;
          return { id: typeof item.id === "string" ? item.id : `task-${year}-${index}-${taskIndex}`, title: typeof item.title === "string" ? item.title : "", children: Array.isArray(item.children) ? item.children.map((child, childIndex) => { const childItem = child as Partial<RoadmapTask>; return { id: typeof childItem.id === "string" ? childItem.id : `child-${year}-${index}-${taskIndex}-${childIndex}`, title: typeof childItem.title === "string" ? childItem.title : "", children: [] }; }) : [] };
        }) : [createTask()];
        return [String(index + 1), { theme: typeof rawMonth?.theme === "string" ? rawMonth.theme : "", mustDo: mustDo.length ? mustDo : [createTask()], chores: tasks("chores"), other: tasks("other") }];
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
  const [editingThemeMonth, setEditingThemeMonth] = useState<string | null>(null);
  const roadmapRef = useRef(roadmap); roadmapRef.current = roadmap;
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef<string | null>(null);
  const yearPlan = roadmap.years[String(selectedYear)] || createYearPlan();
  const birthYear = Number(birthday.slice(0, 4));
  const age = birthYear ? selectedYear - birthYear : null;
  const currentMonth = new Date().getMonth() + 1;
  const orderedMonths = selectedYear === currentYear
    ? Array.from({ length: 12 }, (_, index) => ((currentMonth - 1 + index) % 12) + 1)
    : Array.from({ length: 12 }, (_, index) => index + 1);

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
    setOpenMonths(nextYear === currentYear ? { [String(currentMonth)]: true } : {});
    setEditingThemeMonth(null);
    update((current) => current.years[String(nextYear)] ? current : { ...current, years: { ...current.years, [String(nextYear)]: createYearPlan() } });
  }
  function updateYear(value: Partial<YearPlan>) { update((current) => ({ ...current, years: { ...current.years, [String(selectedYear)]: { ...yearPlan, ...value } } })); }
  function updateMonth(month: string, value: Partial<MonthPlan>) { update((current) => ({ ...current, years: { ...current.years, [String(selectedYear)]: { ...yearPlan, months: { ...yearPlan.months, [month]: { ...yearPlan.months[month], ...value } } } } })); }
  function updateTask(month: string, kind: Exclude<TaskKind, "mustDo">, index: number, value: string) { const tasks = [...yearPlan.months[month][kind]]; tasks[index] = value; updateMonth(month, { [kind]: tasks }); }
  function addTask(month: string, kind: Exclude<TaskKind, "mustDo">) { updateMonth(month, { [kind]: [...yearPlan.months[month][kind], ""] }); }
  function removeTask(month: string, kind: Exclude<TaskKind, "mustDo">, index: number) { const tasks = yearPlan.months[month][kind].filter((_, taskIndex) => taskIndex !== index); updateMonth(month, { [kind]: tasks.length ? tasks : [""] }); }
  function updateMustDo(month: string, id: string, title: string, parentId?: string) { const tasks = yearPlan.months[month].mustDo.map((task) => parentId ? task.id === parentId ? { ...task, children: task.children.map((child) => child.id === id ? { ...child, title } : child) } : task : task.id === id ? { ...task, title } : task); updateMonth(month, { mustDo: tasks }); }
  function addMustDo(month: string, parentId?: string) { const tasks = parentId ? yearPlan.months[month].mustDo.map((task) => task.id === parentId ? { ...task, children: [...task.children, createTask()] } : task) : [...yearPlan.months[month].mustDo, createTask()]; updateMonth(month, { mustDo: tasks }); }
  function removeMustDo(month: string, id: string, parentId?: string) { const tasks = parentId ? yearPlan.months[month].mustDo.map((task) => task.id === parentId ? { ...task, children: task.children.filter((child) => child.id !== id) } : task) : yearPlan.months[month].mustDo.filter((task) => task.id !== id); updateMonth(month, { mustDo: tasks.length ? tasks : [createTask()] }); }
  function taskGroup(month: string, kind: TaskKind) {
    if (kind === "mustDo") {
      const tasks = yearPlan.months[month].mustDo;
      return <section className="annualRoadmapTaskGroup annualRoadmapMustDoGroup" key={kind}><h3>{taskLabels[kind]}</h3>{tasks.map((task) => <div className="annualRoadmapParentTask" key={task.id}><div className="annualRoadmapTask"><span aria-hidden="true" /><input value={task.title} placeholder="やるべきこと" onChange={(event) => updateMustDo(month, task.id, event.target.value)} /><button type="button" onClick={() => removeMustDo(month, task.id)} aria-label="やるべきことを削除">×</button></div><div className="annualRoadmapChildTasks">{task.children.map((child) => <div className="annualRoadmapTask" key={child.id}><span aria-hidden="true" /><input value={child.title} placeholder="子タスク" onChange={(event) => updateMustDo(month, child.id, event.target.value, task.id)} /><button type="button" onClick={() => removeMustDo(month, child.id, task.id)} aria-label="子タスクを削除">×</button></div>)}<button className="annualRoadmapAddChildTask" type="button" onClick={() => addMustDo(month, task.id)}>＋ 子タスクを追加</button></div></div>)}<button className="annualRoadmapAddTask" type="button" onClick={() => addMustDo(month)}>＋ タスクを追加</button></section>;
    }
    const tasks = yearPlan.months[month][kind];
    return <section className="annualRoadmapTaskGroup" key={kind}><h3>{taskLabels[kind]}</h3>{tasks.map((task, taskIndex) => <div className="annualRoadmapTask" key={taskIndex}><span aria-hidden="true" /><input value={task} placeholder={taskLabels[kind]} onChange={(event) => updateTask(month, kind, taskIndex, event.target.value)} /><button type="button" onClick={() => removeTask(month, kind, taskIndex)} aria-label={`${taskLabels[kind]}を削除`}>×</button></div>)}<button className="annualRoadmapAddTask" type="button" onClick={() => addTask(month, kind)}>＋ タスクを追加</button></section>;
  }

  return <main className="shell roadmapPage annualRoadmapPage">
    <div className="annualRoadmapToolbar"><div className="annualRoadmapYearSwitcher"><button type="button" onClick={() => changeYear(-1)} aria-label="前年へ">&lt;</button><strong>{selectedYear}年</strong>{age !== null && <span>{age}歳</span>}<button type="button" onClick={() => changeYear(1)} aria-label="翌年へ">&gt;</button></div></div>
    <section className="annualRoadmapForm"><label className="annualRoadmapTitleField"><input aria-label="年間ロードマップのタイトル" value={yearPlan.title} placeholder="この年のロードマップ" onChange={(event) => updateYear({ title: event.target.value })} /></label><fieldset><legend>年間テーマ</legend>{yearPlan.themes.map((theme, index) => <input key={index} value={theme} placeholder={`テーマ ${index + 1}`} onChange={(event) => { const themes = [...yearPlan.themes]; themes[index] = event.target.value; updateYear({ themes }); }} />)}</fieldset></section>
    <div className="annualRoadmapMonths">{orderedMonths.map((monthNumber) => { const month = String(monthNumber); const label = `${month}月`; const plan = yearPlan.months[month]; const isOpen = Boolean(openMonths[month]); const isCompletedMonthsStart = selectedYear === currentYear && monthNumber === 1 && currentMonth !== 1; const isEditingTheme = editingThemeMonth === month; return <section className={`annualRoadmapMonth${isCompletedMonthsStart ? " isCompletedMonthsStart" : ""}`} key={month}><div className="annualRoadmapMonthHeader"><button className="annualRoadmapMonthToggle" type="button" onClick={() => setOpenMonths((current) => ({ ...current, [month]: !isOpen }))} aria-label={`${label}を${isOpen ? "閉じる" : "開く"}`} aria-expanded={isOpen}>{isOpen ? "⌃" : "⌄"}</button><div className="annualRoadmapMonthTheme" onDoubleClick={() => setEditingThemeMonth(month)}><strong>{label}</strong>{isEditingTheme ? <input autoFocus value={plan.theme} onChange={(event) => updateMonth(month, { theme: event.target.value })} onBlur={() => setEditingThemeMonth(null)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`${label}の月間テーマ`} /> : plan.theme && <span>{plan.theme}</span>}</div></div>{isOpen && <div className="annualRoadmapMonthBody">{taskGroup(month, "mustDo")}<div className="annualRoadmapTaskColumns">{taskGroup(month, "chores")}{taskGroup(month, "other")}</div></div>}</section>; })}</div>
  </main>;
}
