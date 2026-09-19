"use client";

import { Fragment, useEffect, useRef, useState } from "react";

type RoadmapTask = { id: string; title: string; children: RoadmapTask[]; scheduledDate?: string; scheduledTime?: string; done?: boolean };
type MonthPlan = { theme: string; mustDo: RoadmapTask[]; chores: RoadmapTask[]; other: RoadmapTask[] };
type YearPlan = { title: string; themes: string[]; months: Record<string, MonthPlan> };
type RoadmapState = { years: Record<string, YearPlan> };
type TaskKind = "mustDo" | "chores" | "other";

const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const taskLabels: Record<TaskKind, string> = { mustDo: "やるべきこと", chores: "雑務タスク", other: "その他" };

function createTask(): RoadmapTask { return { id: `roadmap-task-${Date.now()}-${Math.random().toString(16).slice(2)}`, title: "", children: [] }; }
function createMonthPlan(): MonthPlan { return { theme: "", mustDo: [createTask()], chores: [createTask()], other: [createTask()] }; }
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
        const tasks = (kind: TaskKind) => Array.isArray(rawMonth?.[kind]) ? rawMonth![kind]!.map((task, taskIndex) => {
          if (typeof task === "string") return { id: `legacy-${year}-${index}-${taskIndex}`, title: task, children: [] };
          const item = task as Partial<RoadmapTask>;
          return { id: typeof item.id === "string" ? item.id : `task-${year}-${index}-${taskIndex}`, title: typeof item.title === "string" ? item.title : "", scheduledDate: typeof item.scheduledDate === "string" ? item.scheduledDate : undefined, scheduledTime: typeof item.scheduledTime === "string" ? item.scheduledTime : undefined, children: Array.isArray(item.children) ? item.children.map((child, childIndex) => { const childItem = child as Partial<RoadmapTask>; return { id: typeof childItem.id === "string" ? childItem.id : `child-${year}-${index}-${taskIndex}-${childIndex}`, title: typeof childItem.title === "string" ? childItem.title : "", scheduledDate: typeof childItem.scheduledDate === "string" ? childItem.scheduledDate : undefined, scheduledTime: typeof childItem.scheduledTime === "string" ? childItem.scheduledTime : undefined, children: [] }; }) : [] };
        }) : [createTask()];
        const mustDo = tasks("mustDo"); const chores = tasks("chores"); const other = tasks("other");
        return [String(index + 1), { theme: typeof rawMonth?.theme === "string" ? rawMonth.theme : "", mustDo: mustDo.length ? mustDo : [createTask()], chores: chores.length ? chores : [createTask()], other: other.length ? other : [createTask()] }];
      })),
    };
  });
  if (!years[String(currentYear)]) years[String(currentYear)] = createYearPlan();
  return { years };
}

function saveRoadmap(value: string) { return fetch("/api/annual-roadmap", { method: "PUT", headers: { "Content-Type": "application/json" }, body: value, keepalive: true }).catch(() => undefined); }

export default function AnnualRoadmapClient({ initialValue, birthday = "", onStateChange }: { initialValue: unknown; birthday?: string; onStateChange?: (value: unknown) => void }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [roadmap, setRoadmap] = useState(() => normalizeState(initialValue, currentYear));
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(() => ({ [String(new Date().getMonth() + 1)]: true }));
  const [editingThemeMonth, setEditingThemeMonth] = useState<string | null>(null);
  const [showPastMonths, setShowPastMonths] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const roadmapRef = useRef(roadmap); roadmapRef.current = roadmap;
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef<string | null>(null);
  const pendingFocusRef = useRef<string | null>(null);
  const yearPlan = roadmap.years[String(selectedYear)] || createYearPlan();
  const birthYear = Number(birthday.slice(0, 4));
  const age = birthYear ? selectedYear - birthYear : null;
  const currentMonth = new Date().getMonth() + 1;
  const orderedMonths = selectedYear === currentYear
    ? Array.from({ length: 12 }, (_, index) => ((currentMonth - 1 + index) % 12) + 1)
    : Array.from({ length: 12 }, (_, index) => index + 1);
  const visibleMonths = selectedYear === currentYear && !showPastMonths
    ? orderedMonths.slice(0, 13 - currentMonth)
    : orderedMonths;

  function enqueue(value: string) {
    if (pendingRef.current === value) return;
    pendingRef.current = value;
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => { await saveRoadmap(value); if (pendingRef.current === value) pendingRef.current = null; });
  }
  function update(updater: (current: RoadmapState) => RoadmapState) {
    const next = updater(roadmapRef.current); roadmapRef.current = next; setRoadmap(next); onStateChange?.(next); enqueue(JSON.stringify(next));
  }
  useEffect(() => () => enqueue(JSON.stringify(roadmapRef.current)), []);
  useEffect(() => {
    const id = pendingFocusRef.current;
    if (!id) return;
    document.querySelector<HTMLInputElement>(`[data-roadmap-task-id="${id}"]`)?.focus();
    pendingFocusRef.current = null;
  }, [roadmap]);
  function changeYear(direction: -1 | 1) {
    const nextYear = selectedYear + direction; setSelectedYear(nextYear);
    setOpenMonths(nextYear === currentYear ? { [String(currentMonth)]: true } : {});
    setEditingThemeMonth(null);
    setShowPastMonths(false);
    update((current) => current.years[String(nextYear)] ? current : { ...current, years: { ...current.years, [String(nextYear)]: createYearPlan() } });
  }
  function updateYear(value: Partial<YearPlan>) { update((current) => ({ ...current, years: { ...current.years, [String(selectedYear)]: { ...yearPlan, ...value } } })); }
  function updateMonth(month: string, value: Partial<MonthPlan>) { update((current) => ({ ...current, years: { ...current.years, [String(selectedYear)]: { ...yearPlan, months: { ...yearPlan.months, [month]: { ...yearPlan.months[month], ...value } } } } })); }
  function updateTask(month: string, kind: Exclude<TaskKind, "mustDo">, id: string, value: Partial<RoadmapTask>) { updateMonth(month, { [kind]: yearPlan.months[month][kind].map((task) => task.id === id ? { ...task, ...value } : task) }); }
  function addTask(month: string, kind: Exclude<TaskKind, "mustDo">, afterId?: string) { const task = createTask(); const current = yearPlan.months[month][kind]; const index = afterId ? current.findIndex((entry) => entry.id === afterId) : -1; const tasks = index < 0 ? [...current, task] : [...current.slice(0, index + 1), task, ...current.slice(index + 1)]; pendingFocusRef.current = task.id; updateMonth(month, { [kind]: tasks }); }
  function removeTask(month: string, kind: Exclude<TaskKind, "mustDo">, id: string) { const tasks = yearPlan.months[month][kind].filter((task) => task.id !== id); updateMonth(month, { [kind]: tasks.length ? tasks : [createTask()] }); }
  function updateMustDo(month: string, id: string, value: Partial<RoadmapTask>, parentId?: string) { const tasks = yearPlan.months[month].mustDo.map((task) => parentId ? task.id === parentId ? { ...task, children: task.children.map((child) => child.id === id ? { ...child, ...value } : child) } : task : task.id === id ? { ...task, ...value } : task); updateMonth(month, { mustDo: tasks }); }
  function presetDate(value: string) { if (value === "today") return new Date().toISOString().slice(0, 10); if (value === "tomorrow") { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); } return undefined; }
  function addMustDo(month: string, parentId?: string) { const nextTask = createTask(); const tasks = parentId ? yearPlan.months[month].mustDo.map((task) => task.id === parentId ? { ...task, children: [...task.children, nextTask] } : task) : [...yearPlan.months[month].mustDo, nextTask]; pendingFocusRef.current = nextTask.id; updateMonth(month, { mustDo: tasks }); }
  function removeMustDo(month: string, id: string, parentId?: string) { const tasks = parentId ? yearPlan.months[month].mustDo.map((task) => task.id === parentId ? { ...task, children: task.children.filter((child) => child.id !== id) } : task) : yearPlan.months[month].mustDo.filter((task) => task.id !== id); updateMonth(month, { mustDo: tasks.length ? tasks : [createTask()] }); }
  function taskGroup(month: string, kind: TaskKind) {
    if (kind === "mustDo") {
      const tasks = yearPlan.months[month].mustDo;
      return <section className="annualRoadmapTaskGroup annualRoadmapMustDoGroup" key={kind}><h3>{taskLabels[kind]}</h3>{tasks.map((task) => { const collapsed = collapsedParents[task.id]; return <div className="annualRoadmapParentTask" key={task.id}><div className="annualRoadmapTask annualRoadmapScheduledTask">{task.children.length > 0 ? <button className="annualRoadmapParentToggle" type="button" onClick={() => setCollapsedParents((current) => ({ ...current, [task.id]: !collapsed }))} aria-label="子タスクを開閉">{collapsed ? "›" : "⌄"}</button> : <span aria-hidden="true" />}<input data-roadmap-task-id={task.id} value={task.title} placeholder="やるべきこと" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); addMustDo(month); } }} onChange={(event) => updateMustDo(month, task.id, { title: event.target.value })} /><input type="date" value={task.scheduledDate || ""} onChange={(event) => updateMustDo(month, task.id, { scheduledDate: event.target.value || undefined })} aria-label="予定日" /><input type="time" value={task.scheduledTime || ""} onChange={(event) => updateMustDo(month, task.id, { scheduledTime: event.target.value || undefined })} aria-label="予定時刻" /><button type="button" onClick={() => removeMustDo(month, task.id)} aria-label="やるべきことを削除">×</button></div>{!collapsed && <div className="annualRoadmapChildTasks">{task.children.map((child) => <div className="annualRoadmapTask annualRoadmapScheduledTask" key={child.id}><span aria-hidden="true" /><input data-roadmap-task-id={child.id} value={child.title} placeholder="子タスク" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); addMustDo(month, task.id); } }} onChange={(event) => updateMustDo(month, child.id, { title: event.target.value }, task.id)} /><input type="date" value={child.scheduledDate || ""} onChange={(event) => updateMustDo(month, child.id, { scheduledDate: event.target.value || undefined }, task.id)} aria-label="予定日" /><input type="time" value={child.scheduledTime || ""} onChange={(event) => updateMustDo(month, child.id, { scheduledTime: event.target.value || undefined }, task.id)} aria-label="予定時刻" /><button type="button" onClick={() => removeMustDo(month, child.id, task.id)} aria-label="子タスクを削除">×</button></div>)}<button className="annualRoadmapAddChildTask" type="button" onClick={() => addMustDo(month, task.id)}>＋ 子タスクを追加</button></div>}</div>; })}<button className="annualRoadmapAddTask" type="button" onClick={() => addMustDo(month)}>＋ タスクを追加</button></section>;
    }
    const tasks = yearPlan.months[month][kind];
    return <section className="annualRoadmapTaskGroup" key={kind}><h3>{taskLabels[kind]}</h3>{tasks.map((task) => <div className="annualRoadmapTask annualRoadmapScheduledTask" key={task.id}><span aria-hidden="true" /><input data-roadmap-task-id={task.id} value={task.title} placeholder={taskLabels[kind]} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTask(month, kind, task.id); } }} onChange={(event) => updateTask(month, kind, task.id, { title: event.target.value })} /><input type="date" value={task.scheduledDate || ""} onChange={(event) => updateTask(month, kind, task.id, { scheduledDate: event.target.value || undefined })} aria-label="予定日" /><input type="time" value={task.scheduledTime || ""} onChange={(event) => updateTask(month, kind, task.id, { scheduledTime: event.target.value || undefined })} aria-label="予定時刻" /><button type="button" onClick={() => removeTask(month, kind, task.id)} aria-label={`${taskLabels[kind]}を削除`}>×</button></div>)}<button className="annualRoadmapAddTask" type="button" onClick={() => addTask(month, kind)}>＋ タスクを追加</button></section>;
  }

  return <main className="shell roadmapPage annualRoadmapPage">
    <div className="annualRoadmapToolbar"><div className="annualRoadmapYearSwitcher"><button type="button" onClick={() => changeYear(-1)} aria-label="前年へ">&lt;</button><strong>{selectedYear}年</strong>{age !== null && <span>{age}歳</span>}<button type="button" onClick={() => changeYear(1)} aria-label="翌年へ">&gt;</button></div></div>
    <section className="annualRoadmapForm"><label className="annualRoadmapTitleField"><input aria-label="年間ロードマップのタイトル" value={yearPlan.title} placeholder="この年のロードマップ" onChange={(event) => updateYear({ title: event.target.value })} /></label><fieldset><legend>年間テーマ</legend>{yearPlan.themes.map((theme, index) => <input key={index} value={theme} placeholder={`テーマ ${index + 1}`} onChange={(event) => { const themes = [...yearPlan.themes]; themes[index] = event.target.value; updateYear({ themes }); }} />)}</fieldset></section>
    <div className="annualRoadmapMonths">{visibleMonths.map((monthNumber) => { const month = String(monthNumber); const label = `${month}月`; const plan = yearPlan.months[month]; const isOpen = Boolean(openMonths[month]); const isCompletedMonthsStart = selectedYear === currentYear && monthNumber === 1 && currentMonth !== 1; const isEditingTheme = editingThemeMonth === month; return <Fragment key={month}><section className={`annualRoadmapMonth${isCompletedMonthsStart ? " isCompletedMonthsStart" : ""}`}><div className="annualRoadmapMonthHeader"><button className="annualRoadmapMonthToggle" type="button" onClick={() => setOpenMonths((current) => ({ ...current, [month]: !isOpen }))} aria-label={`${label}を${isOpen ? "閉じる" : "開く"}`} aria-expanded={isOpen}>{isOpen ? "⌃" : "⌄"}</button><div className="annualRoadmapMonthTheme" onDoubleClick={() => setEditingThemeMonth(month)}><strong>{label}</strong>{isEditingTheme ? <input autoFocus value={plan.theme} onChange={(event) => updateMonth(month, { theme: event.target.value })} onBlur={() => setEditingThemeMonth(null)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`${label}の月間テーマ`} /> : plan.theme && <span>{plan.theme}</span>}</div></div>{isOpen && <div className="annualRoadmapMonthBody">{taskGroup(month, "mustDo")}<div className="annualRoadmapTaskColumns">{taskGroup(month, "chores")}{taskGroup(month, "other")}</div></div>}</section>{selectedYear === currentYear && monthNumber === 12 && currentMonth !== 1 && <button className="annualRoadmapPastMonthsToggle" type="button" onClick={() => setShowPastMonths((current) => !current)} aria-expanded={showPastMonths}>{showPastMonths ? "過去の月を隠す" : "過去の月を見る"}</button>}</Fragment>; })}</div>
  </main>;
}
